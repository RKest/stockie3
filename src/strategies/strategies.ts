import { StockDataObject } from "../stocks/stockPrices";
import { getMovingAverage, getRSI, getBollingerBand, averageData, bolingerBandsEnum } from "../stocks/indicators";
import { promises, readFileSync, writeFileSync } from "fs";
import { IStrategySelector, isKeyArrayVaild, isKeyInTheArray } from "./backtest";
import { isStrategyInAction } from "./live";
import { promisify } from "util";
const sleep = promisify(setTimeout);
const NO_STRATEGIES = 4;

export {
    RSI_Strategy,
    BB_Breakout_Strategy,
    MA_Cross_Strategy,
    HODL_Strategy,
    MarketActions,
    StrategyType
}

type StrategyType = typeof SavableStrategyLabels.bb | typeof SavableStrategyLabels.ma | typeof SavableStrategyLabels.rsi | typeof SavableStrategyLabels.hdl;

interface IStrategy{
    balance: number;
    portfolio: IPortfolioElement[];
}

interface IPortfolioElement{
    symbol: string;
    amount: number;
    quota: number;
    supports?: number[];
    resistances?: number[];
    stopLoss?: number;
    takeProfit? : number;
}

enum MarketActions{
    HOLD = 0,
    BUY = 1,
    SELL = 2
}

abstract class Strategy implements IStrategy{
    abstract strategyType: StrategyType;
    startingBalance: number;
    balance: number;
    portfolio: IPortfolioElement[];
    constructor(portfolio: IPortfolioElement[] = [], startingBalance = 10000){
        this.startingBalance = startingBalance;
        this.balance = startingBalance;
        this.portfolio = portfolio;
    }

    buy(symbol: string, quota: number, percentage: number): void{
        this.portfolio.push({
            symbol: symbol,
            amount: +(this.balance * percentage) / +quota,
            quota: quota
        });
        this.balance -= this.balance * percentage;
    }

    sell(symbol: string, quota: number): void{
        const portfolioElement = this.portfolio.find(el => el.symbol === symbol);
        if(portfolioElement){
            this.balance += quota * portfolioElement.amount;
            this.portfolio = this.portfolio.filter(el => el.symbol !== symbol);
        }
    }

    validateStrategy = async ({symbol}: StockDataObject, strategyType: StrategyType, labels: ISavableStrategyLabels) => {
        const testedStrategies: IStrategySelector[] = JSON.parse(await promises.readFile(__dirname + '/_strategies.json', 'utf-8'));

        const strategiesForSymbol = testedStrategies.find(str => str.symbol === symbol);

        if(!strategiesForSymbol?.optimalStrategy && strategiesForSymbol?.testedStrategies.length !== NO_STRATEGIES) 
            throw new Error(`Optimal strategy not established for symbol ${symbol}`);

        const strategyKeys = strategiesForSymbol.testedStrategies.map(str => str.strategy);
        
        if(!isKeyArrayVaild(strategyKeys))
            throw new Error(`Invalid strategy keys for symbol ${symbol}`);
        
        const strategyKeyForSymbol = strategyKeys.find(key => labels[key] === strategyType);

        if(!strategyKeyForSymbol)
            throw new Error(`Strategy has unnknown strategy key`);

        const strategyForSymbol = strategiesForSymbol.testedStrategies.find(str => str.strategy === strategyKeyForSymbol);

        if(!strategyForSymbol)
            throw new Error(`Strategy for symbol ${symbol} returned ${strategyForSymbol}`);

        if(!strategyForSymbol.postTestingBalance)
            throw new Error(`Strategy ${strategyForSymbol} didn't return balance`);

        return strategyForSymbol;
    }

}

class RSI_Strategy extends Strategy {
    strategyType: typeof SavableStrategyLabels.rsi;
    rsiLength: number;
    buyThreshold: number;
    sellThreshold: number;

    constructor(rsiLength = 14, buyThreshold = 30, sellThreshold = 70){
        super();

        this.strategyType = SavableStrategyLabels.rsi;
        this.rsiLength = rsiLength;
        this.buyThreshold = buyThreshold;
        this.sellThreshold = sellThreshold;
    }

    async eval(stockData: StockDataObject, offsetIndex = 1, signal?: boolean): Promise<number> {
        const { symbol, data } = stockData;
        const evalIndex = data.length - offsetIndex;

        if(evalIndex + 1 <= this.rsiLength) {
            this.sell(symbol, data[evalIndex].close);
            return this.balance;
        }

        const stockDataSlice = data.slice(evalIndex - this.rsiLength);
        const averagedStockDataSlice = stockDataSlice.map(d => averageData(d));
        const RSI = getRSI(averagedStockDataSlice, this.rsiLength);

        const buy = () => this.buy(symbol, data[evalIndex].open, 1);
        const sell = () => this.sell(symbol, data[evalIndex].close);

        if(RSI < this.buyThreshold && this.portfolio.every(el => el.symbol !== symbol))
            buy();
        if(RSI > this.sellThreshold && this.portfolio.some(el => el.symbol === symbol))
            sell();
        
        /*-------------------------------------------MAYBE A LESS RISKY STRATEGY---------------------------------------------------

        if(RSI < 30 && this.portfolio.every(el => el.symbol !== symbol))            //Setting of a potential investment
            signal = true;
        if(RSI > 30 && signal)                                                      //Executing after a recovery
            {signal = false;  buy();}
        if(RSI < 30 && this.portfolio.some(el => el.symbol === symbol))             //Stop Loss
            sell();
        if(RSI > 70 && this.portfolio.some(el => el.symbol === symbol))             //Take Profit
            sell();
        */
        await sleep(3)
        return await this.eval(stockData, ++offsetIndex, signal);
    }

    async evalLive(stockData: StockDataObject): Promise<MarketActions>{
        const { symbol, data } = stockData;
        const strategyForSymbol = await this.validateStrategy(stockData, this.strategyType, SavableStrategyLabels);

        if(!strategyForSymbol || !strategyForSymbol.postTestingBalance)
            throw new Error(`Strategy ${this.strategyType} for symbol ${symbol} didn't pass validation`);

        if(strategyForSymbol.postTestingBalance < 10000)
            return MarketActions.HOLD;

        const sellOverBuySignal = await isStrategyInAction(symbol, this.strategyType);

        const stockDataSlice = data.slice(0, this.rsiLength);
        const averagedStockDataSlice = stockDataSlice.map(d => averageData(d)).reverse();
        const RSI = getRSI(averagedStockDataSlice, this.rsiLength);

        if(RSI < this.buyThreshold && !sellOverBuySignal)
            return MarketActions.BUY;
        
        if(RSI > this.sellThreshold && sellOverBuySignal)
            return MarketActions.SELL;

        return MarketActions.HOLD;
    }
}


class BB_Breakout_Strategy extends Strategy {
    strategyType: typeof SavableStrategyLabels.bb;
    bollingerBandLength: number;
    bollingerBandTrendLength: number;
    stopLossPercentage: number; //0 to 1

    constructor(bollingerBandLength: number, stopLossPercentage: number, bollingerBandTrendLength = 2){
        super();

        this.strategyType = SavableStrategyLabels.bb;
        this.bollingerBandLength = bollingerBandLength;
        this.bollingerBandTrendLength = bollingerBandTrendLength;
        this.stopLossPercentage = stopLossPercentage;
    }

    async eval(stockData: StockDataObject, pastBB: number[] = [], localTrendLength = 0, offsetIndex = 1): Promise<number> {
        //console.log(`eval at BB`);
        const { symbol, data } = stockData;
        const { Upper, Lower } = bolingerBandsEnum;

        
        const evalIndex = data.length - offsetIndex;
        if(evalIndex + 1 <= this.bollingerBandLength){
            this.sell(symbol, data[evalIndex].close);
            return this.balance;
        }

        const stockDataSlice = data.slice(evalIndex - this.bollingerBandLength);
        const averagedStockDataSlice = stockDataSlice.map(d => averageData(d));
        const upperBB = getBollingerBand(averagedStockDataSlice, this.bollingerBandLength, Upper);
        const lowerBB = getBollingerBand(averagedStockDataSlice, this.bollingerBandLength, Lower);
        
        if (pastBB[0] < upperBB && pastBB[1] > lowerBB && this.portfolio.every(el => el.symbol !== symbol)){
            localTrendLength++;
            if(localTrendLength >= this.bollingerBandTrendLength)
                this.buy(symbol, data[evalIndex].open, 1);
        }

        if(pastBB[0] > upperBB && this.portfolio.some(el => el.symbol === symbol))
            this.sell(symbol, data[evalIndex].close);
        
        const portfolioElement = this.portfolio.find(el => el.symbol === symbol);
        const averageDataAtInex = averageData(data[evalIndex]);
        if(portfolioElement && portfolioElement.quota >= +averageDataAtInex + +averageDataAtInex * this.stopLossPercentage && this.portfolio.some(el => el.symbol === symbol))
            this.sell(symbol, data[evalIndex].close);
        if(averageDataAtInex <= getMovingAverage(averagedStockDataSlice, 9) && this.portfolio.some(el => el.symbol === symbol))//Technically if the ma length is lower then bb length some weird stuff could happen
            this.sell(symbol, data[evalIndex].close);

        await sleep(3);
        return await this.eval(stockData, [upperBB, lowerBB], localTrendLength, ++offsetIndex);
    }


    async evalLive(stockData: StockDataObject): Promise<MarketActions>{
        const { symbol, data } = stockData;
        const strategyForSymbol = await this.validateStrategy(stockData, this.strategyType, SavableStrategyLabels);

        if(!strategyForSymbol || !strategyForSymbol.postTestingBalance)
            throw new Error(`Strategy ${this.strategyType} for symbol ${symbol} didn't pass validation`);

        if(strategyForSymbol.postTestingBalance < 10000)
            return MarketActions.HOLD;

        const sellOverBuySignal = await isStrategyInAction(symbol, this.strategyType);
        
        if(data[0].close <= data[1].close && sellOverBuySignal)
            return MarketActions.SELL;

        const { Upper, Lower } = bolingerBandsEnum;

        const pastBB: Array<Array<number>> = [];
        for(var i = this.bollingerBandTrendLength; i >= 0; i--){
            const stockDataSlice = data.slice(i, this.bollingerBandLength + i);
            const averagedStockDataSlice = stockDataSlice.map(d => averageData(d));
            const upperBB = getBollingerBand(averagedStockDataSlice, this.bollingerBandLength, Upper);
            const lowerBB = getBollingerBand(averagedStockDataSlice, this.bollingerBandLength, Lower);
            pastBB.push([upperBB, lowerBB]);
        }
        for(var i = 0; i < pastBB.length; i++){
            if(i + 1 === pastBB.length) break;
            if(pastBB[i][0] >= pastBB[i+1][0] || pastBB[i][1] <= pastBB[i+1][1] || sellOverBuySignal)
                return MarketActions.HOLD;
        }
        return MarketActions.BUY;
    }
}

enum MA_Orientation {
    SHORT_OVER_LONG = 0,
    LONG_OVER_SHORT = 1
}

class MA_Cross_Strategy extends Strategy {
    strategyType: typeof SavableStrategyLabels.ma;
    shortMovingAverageLength: number;
    longMovingAverageLength: number;
    constructor(shortMovingAverageLength: number, longMovingAverageLength: number){
        super();

        this.strategyType = SavableStrategyLabels.ma;
        this.shortMovingAverageLength = shortMovingAverageLength;
        this.longMovingAverageLength = longMovingAverageLength;
    }

    eval(stockData: StockDataObject, offsetIndex = 1, orientation?: MA_Orientation): number{
        const { symbol, data } = stockData;

        const evalIndex = data.length - offsetIndex;
        if(evalIndex + 1 <= this.longMovingAverageLength){
            this.sell(symbol, data[evalIndex].close);
            return this.balance;
        }
        
        const shortStockDataSlice = data.slice(evalIndex - this.shortMovingAverageLength);
        const shortAveragedStockDataSlice = shortStockDataSlice.map(d => averageData(d));
        const shortMA = getMovingAverage(shortAveragedStockDataSlice, this.shortMovingAverageLength);

        const longStockDataSlice = data.slice(evalIndex - this.shortMovingAverageLength);
        const longAveragedStockDataSlice = longStockDataSlice.map(d => averageData(d));
        const longMA = getMovingAverage(longAveragedStockDataSlice, this.shortMovingAverageLength);

        const localOrientation = shortMA >= longMA;
        if(!orientation && localOrientation && this.portfolio.every(el => el.symbol !== symbol))
            this.buy(symbol, data[evalIndex].open, 1);
        if(orientation && !localOrientation && this.portfolio.some(el => el.symbol === symbol))
            this.sell(symbol, data[evalIndex].close);

        return this.eval(stockData, ++offsetIndex, +localOrientation);

    }

    async evalLive(stockData: StockDataObject): Promise<MarketActions> {
        const { symbol, data } = stockData;
        const strategyForSymbol = await this.validateStrategy(stockData, this.strategyType, SavableStrategyLabels);

        if(!strategyForSymbol || !strategyForSymbol.postTestingBalance)
            throw new Error(`Strategy ${this.strategyType} for symbol ${symbol} didn't pass validation`);

        if(strategyForSymbol.postTestingBalance < 10000)
            return MarketActions.HOLD;

        const sellOverBuySignal = await isStrategyInAction(symbol, this.strategyType);

        const prevShortStockDataSlice = data.slice(1, this.shortMovingAverageLength + 1);
        const prevShortAveragedStockDataSlice = prevShortStockDataSlice.map(d => averageData(d));
        const prevShortMA = getMovingAverage(prevShortAveragedStockDataSlice, this.shortMovingAverageLength);

        const prevLongStockDataSlice = data.slice(1, this.shortMovingAverageLength + 1);
        const prevLongAveragedStockDataSlice = prevLongStockDataSlice.map(d => averageData(d));
        const prevLongMA = getMovingAverage(prevLongAveragedStockDataSlice, this.shortMovingAverageLength);

        const shortStockDataSlice = data.slice(0, this.shortMovingAverageLength);
        const shortAveragedStockDataSlice = shortStockDataSlice.map(d => averageData(d));
        const shortMA = getMovingAverage(shortAveragedStockDataSlice, this.shortMovingAverageLength);

        const longStockDataSlice = data.slice(0, this.shortMovingAverageLength);
        const longAveragedStockDataSlice = longStockDataSlice.map(d => averageData(d));
        const longMA = getMovingAverage(longAveragedStockDataSlice, this.shortMovingAverageLength);

        if(prevShortMA <= prevLongMA && shortMA >= longMA && prevLongMA <= longMA && !sellOverBuySignal)
            return MarketActions.BUY;
        if(prevShortMA >= prevLongMA && shortMA <= longMA && sellOverBuySignal){
            return MarketActions.SELL;
        }

        return MarketActions.HOLD;
        
    }

}

class HODL_Strategy extends Strategy{
    strategyType: typeof SavableStrategyLabels.hdl;
    constructor(){
        super();

        this.strategyType = SavableStrategyLabels.hdl;
    }

    eval(stockData: StockDataObject, offsetIndex = 1): number{
        const { symbol, data } = stockData;
        const evalIndex = data.length - offsetIndex;

        if(evalIndex == 0){
            this.sell(symbol, data[evalIndex].close);
            return this.balance;
        }

        if(evalIndex == data.length - 1)
            this.buy(symbol, data[evalIndex].open, 1);

        return this.eval(stockData, ++offsetIndex);
        
    }
}

interface ISavableStrategyLabels{
    bb: typeof BB_Breakout_Strategy,
    ma: typeof MA_Cross_Strategy,
    rsi: typeof RSI_Strategy,
    hdl?: typeof HODL_Strategy
}

const SavableStrategyLabels = {
    bb: BB_Breakout_Strategy,
    ma: MA_Cross_Strategy,
    rsi: RSI_Strategy,
    hdl: HODL_Strategy
};



