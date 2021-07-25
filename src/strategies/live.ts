import { promises, readFileSync } from "fs";
import { BB_Breakout_Strategy, MA_Cross_Strategy, RSI_Strategy, StrategyType, MarketActions, HODL_Strategy } from "./strategies";
import { STRATEGY_PATH, IStrategySelector } from "./backtest";

export {
    getLivePortfolio,
    getLivePortfolioSync,
    instantiateStrategies,
    isStrategyInAction,
    updatePortfolio,
    getPortfolioLength,
    getStrategyParams
}

const SavableStrategyLabels = {
    bb: BB_Breakout_Strategy,
    ma: MA_Cross_Strategy,
    rsi: RSI_Strategy
};

interface ILiveStrategy {
    symbol: string;
    strategy: string;
}

const getPortfolioLength = (): number => {
    const portfolio = getLivePortfolioSync();
    return portfolio.length;;
}

const getLivePortfolio = async (): Promise<ILiveStrategy[]> => {
    return JSON.parse(await promises.readFile(__dirname + '/_livePortfolio.json', 'utf-8'));
}

const getLivePortfolioSync = (): ILiveStrategy[] => {
    return JSON.parse(readFileSync(__dirname + '/_livePortfolio.json', 'utf-8'));
}

const isStrategyInAction = async (symbol: string, strategy: StrategyType): Promise<boolean> => {
    const portfolio = await getLivePortfolio();
    const strategyKeys = Object.keys(SavableStrategyLabels);
    if (!isKeyArrayVaild(strategyKeys))
        throw new Error(`${JSON.stringify(strategyKeys)} is not a valid key array`);

    const strategyKey = strategyKeys.find(key => SavableStrategyLabels[key] === strategy);
    if (portfolio.find(el => el.symbol === symbol && el.strategy === strategyKey))
        return true;

    return false;
}

const updatePortfolio = async (symbol: string, strategy: StrategyType, action: MarketActions) => {
    const portfolio = await getLivePortfolio();
    const strategyKeys = Object.keys(SavableStrategyLabels);
    if (!isKeyArrayVaild(strategyKeys))
        throw new Error(`${JSON.stringify(strategyKeys)} is not a valid key array`);

    const strategyKey = strategyKeys.find(key => SavableStrategyLabels[key] === strategy);

    if (!strategyKey)
        throw new Error('Invalid strategy key at live.ts');

    const portfolioElement: ILiveStrategy = {
        symbol: symbol,
        strategy: strategyKey
    }

    if(action === MarketActions.SELL)
        if (portfolio.every(el => el.symbol !== portfolioElement.symbol && el.strategy !== portfolioElement.strategy))
            throw new Error(`Cannot sell ${portfolioElement} item not in the portfolio`);
        else{
            const index = portfolio.findIndex(el => el.symbol === symbol && el.strategy === strategyKey);
            if(index === -1)
                throw new Error(`Cannot sell ${portfolioElement} index equals -1`);
            portfolio.splice(index, 1);
        }
    else
        portfolio.push(portfolioElement);

    await promises.writeFile(__dirname + '/_livePortfolio.json', JSON.stringify(portfolio, null, 1));
}

const isKeyArrayVaild = (codons: string[]): codons is Array<keyof typeof SavableStrategyLabels> => {
    return codons.every(isKeyInTheArray);
}
const isKeyInTheArray = (value: string): value is keyof typeof SavableStrategyLabels => {
    return value in SavableStrategyLabels;
}

const instantiateStrategies = (symbol: string, strategyLabel: string) => {
    if(!isKeyInTheArray(strategyLabel))
        throw new Error(`${strategyLabel} returned invalid label keys`);

    const Strategy = SavableStrategyLabels[strategyLabel];
    const Params = getStrategyParams(symbol, strategyLabel);
    
    switch(Strategy){
        case BB_Breakout_Strategy:
            return new Strategy(Params[0], Params[1], Params[2]);
        case MA_Cross_Strategy: 
            return new Strategy(Params[0], Params[1]);
        case RSI_Strategy: 
            return new Strategy(Params[0], Params[1], Params[2]);
        default: 
            throw new Error('Unknown strategy to instantiate');
    }
}

const getStrategyParams = (symbol: string, strategyLabel: string) => {
    const strategies: IStrategySelector[] = JSON.parse(readFileSync(STRATEGY_PATH, 'utf-8'));
    const strategyForSymbol = strategies.find(str => str.symbol === symbol);

    if(!strategyForSymbol)
        throw new Error(`No strategy param instantiated for ${symbol}`);

    const strategyMatchingLabel = strategyForSymbol.testedStrategies.find(str => str.strategy === strategyLabel);

    if(!strategyMatchingLabel)
        throw new Error(`No strategy found matching strategyLabel equal ${strategyLabel}`);

    const strategyBounds = strategyMatchingLabel.strategyParamBounds;
    return strategyBounds.map(bound => (bound.Lower + bound.Upper) / 2);
}
