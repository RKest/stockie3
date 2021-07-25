import { getStockData, getStockSymbols, getStockSymbolsSync, StockDataObject } from "./stocks/stockPrices";
import { assignStrategy } from "./strategies/backtest";
import { promisify } from "util";
import Brokerage from "./brokerage/et";
import Scanner, { initiateHistoricData } from "./scanning/tvScanner";
import { instantiateStrategies, getPortfolioLength, updatePortfolio, getStrategyParams } from "./strategies/live";
import { BB_Breakout_Strategy, MA_Cross_Strategy, RSI_Strategy, StrategyType } from "./strategies/strategies";
import { delayMarketScanning, formSchedule } from "./scanning/scheduler";
import { MarketActions } from "./strategies/strategies";
import { uniqifyStocks } from "./helpers/stock-list-manipulation";

const update = (count: number, outOf: number) => console.log(`${count} out of ${outOf}`);
let portfolioCap = 9;
let portfolioLength = getPortfolioLength();

(async () => {

    // const dataSymbols = getStockSymbolsSync();
    // for (const symbol of dataSymbols) {
    //     const stockData = await getStockData(symbol);
    //     for(var i = 0; i < 50; i++){
    //         const isOptimalStrategyFound = await assignStrategy(stockData);
    //         if(isOptimalStrategyFound)
    //             break;
    //     }
    //     await initiateHistoricData(stockData);
    //     update(dataSymbols.indexOf(symbol), dataSymbols.length);
    // }

    const sleep = promisify(setTimeout);
    const brokerage = new Brokerage(portfolioCap);
    const scanner = new Scanner();

    process.on('SIGINT', () => {
        console.log('\nClosing');
        scanner.close().then(() => {
            console.log('Closed');
            process.exit();
        });
    });

    await Promise.all([
        scanner.launch(),
        brokerage.launch()
    ]);

    const schedule = formSchedule('TSLA');
    await delayMarketScanning(schedule);

    console.log('👌');

    while (true) {
        const symobls = await getStockSymbols();
        const stockData = await scanner.scan(symobls);

        portfolioLength = getPortfolioLength();

        executePositions(stockData, brokerage).then(async resArr => {

            for(const res of resArr) {
                if(res.isSuccessfull)
                    await updatePortfolio(res.symbol, res.strategy, res.action);
                else
                    await fallbackExecution(res, brokerage).then(async res => {
                        await updatePortfolio(res.symbol, res.strategy, res.action);
                    });
            }

        }).catch(err => console.log(err));

       await sleep(300000);
    }

})();

interface IMarketResponse {
    symbol: string;
    strategy: StrategyType;
    isSuccessfull: boolean;
    action: MarketActions;
}


async function executePositions(stockData: StockDataObject[], brokerage: Brokerage): Promise<IMarketResponse[]>{
    const { BUY, SELL, HOLD } = MarketActions;

    const marketResponses: IMarketResponse[] = []
    
    for(const data of stockData){
        const rsi = instantiateStrategies(data.symbol, 'rsi');
        const rsiSignal = await rsi.evalLive(data);
        //const maSignal = await ma.evalLive(data);

        if(rsiSignal === SELL){
            portfolioLength--;
            const rsiSellResponse = await brokerage.sellSymbol(data.symbol);
            marketResponses.push({
                isSuccessfull: rsiSellResponse,
                strategy: RSI_Strategy,
                symbol: data.symbol,
                action: SELL
            });
        }

        if(rsiSignal === BUY && portfolioLength < portfolioCap){
            portfolioLength++;
            const rsiBuyResponse = await brokerage.buySymbol(data.symbol, portfolioLength);    
            marketResponses.push({
                isSuccessfull: rsiBuyResponse,
                strategy: RSI_Strategy,
                symbol: data.symbol,
                action: BUY
            });
        }

        // if(maSignal === SELL){
        //     const maSellResponse = await brokerage.sellSymbol(data.symbol);
        //     marketResponses.push({
        //         isSuccessfull: maSellResponse,
        //         strategy: MA_Cross_Strategy,
        //         symbol: data.symbol,
        //         action: SELL
        //     });
        // }

        // if(maSignal === BUY){
        //     const maBuyResponse = await brokerage.buySymbol(data.symbol);
        //     marketResponses.push({
        //         isSuccessfull: maBuyResponse,
        //         strategy: MA_Cross_Strategy,
        //         symbol: data.symbol,
        //         action: BUY
        //     });
        // }
    }
    
    return marketResponses;
}

async function fallbackExecution(res: IMarketResponse, brokerage: Brokerage): Promise<IMarketResponse>{
    const { BUY, SELL } = MarketActions;
    const { action, strategy, symbol } = res;

    let inRes;
    if(action === BUY)
        inRes = await brokerage.buySymbol(symbol, portfolioLength);
    else
        inRes = await brokerage.sellSymbol(symbol);

    if(!inRes)
        return fallbackExecution({ symbol: symbol, action: action, strategy: strategy, isSuccessfull: inRes }, brokerage);
    else
        return res;
}
