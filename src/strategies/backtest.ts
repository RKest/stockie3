import { promises } from "fs";

import { BB_Breakout_Strategy, MA_Cross_Strategy, RSI_Strategy, HODL_Strategy, StrategyType } from './strategies';
import { StockDataObject, getStockData } from '../stocks/stockPrices';

export {
    assignStrategy,
    IStrategySelector,
    SavableStrategyLabels,
    isKeyArrayVaild,
    isKeyInTheArray,
    STRATEGY_PATH
}

type Strategies = typeof BB_Breakout_Strategy |  typeof MA_Cross_Strategy | typeof RSI_Strategy | typeof HODL_Strategy;

enum TestedStrategyRepresentation {
    UNCHANGED = 0,
    BUMPED_UP_LOWER = 1,
    BUMPED_DOWN_UPPER = 2,
}

interface IStrategySelector {
    symbol: string;
    testedStrategies: ITestedStrategy[];
    optimalStrategy?: string;
}

interface ITestedStrategy {
    strategy: string;
    strategyParams: number[];
    strategyParamBounds: IIndividualStrategyBounds[];
    lastParamBoundsChanges: TestedStrategyRepresentation[];
    postTestingBalance?: number;
}

interface IStrategyParamBounds {
    bb: IIndividualStrategyBounds[]
    ma: IIndividualStrategyBounds[]
    rsi: IIndividualStrategyBounds[]
}

interface IIndividualStrategyBounds {
    Lower: number;
    Upper: number;
}

interface IStrategyAlterationObject {
    strategyBounds: IIndividualStrategyBounds[];
    stratedyChanges: TestedStrategyRepresentation[];
}


const STRATEGY_PATH = __dirname + '/_strategies.json';

const SavableStrategyLabels = {
    bb: BB_Breakout_Strategy,
    ma: MA_Cross_Strategy,
    rsi: RSI_Strategy,
    hdl: HODL_Strategy
};

const isKeyInDefaultParamBounds = (key: string): key is keyof typeof DefaultStrategyBounds => {
    return key in DefaultStrategyBounds;
}

let isOptimalStrategyFoundCounter = 0;

const assignStrategy = async (stockData: StockDataObject): Promise<boolean> => {
    const { symbol } = stockData;
    const assignedStrategies: IStrategySelector[] = JSON.parse(await promises.readFile(STRATEGY_PATH, 'utf-8'));
    const ChosenStrategy = choseStrategy(symbol, assignedStrategies);

    if(!ChosenStrategy) 
        throw new Error(`Chosen strategy returned ${ChosenStrategy}`);

    const strategyKey = getStrategyKey(ChosenStrategy);

    const defaultStrategySelector: IStrategySelector = { symbol: symbol, testedStrategies: [] }
    const strategySelectorForSymbol: IStrategySelector = assignedStrategies.find(str => str.symbol === symbol) || defaultStrategySelector;

    const priorStrategy = strategySelectorForSymbol.testedStrategies.find(el => el.strategy === strategyKey);

    const priorStrategyParamBounds = priorStrategy?.strategyParamBounds;
    const priorStrategyParamBoundChanges = priorStrategy?.lastParamBoundsChanges;
    const priorStrategyParamValues = priorStrategy?.strategyParams;
    const priorPostStrategyBalance = priorStrategy?.postTestingBalance;

    const strategyParamBoundsObject = instantiateParamBounds(
        ChosenStrategy, 
        (!priorStrategyParamBounds || !priorStrategyParamBoundChanges) ? undefined :
        { strategyBounds: priorStrategyParamBounds, stratedyChanges: priorStrategyParamBoundChanges }, 
        priorStrategyParamValues
    );
    const exactStrategyParams = strategyParamBoundsObject.strategyBounds.map(param => (param.Upper + param.Lower) / 2);
    const instantiatedStrategy = instantiateStrategy(ChosenStrategy, exactStrategyParams);
    let postStrategyBalance = await instantiatedStrategy.eval(stockData);
    
    if(priorPostStrategyBalance && priorStrategyParamBounds && priorPostStrategyBalance > postStrategyBalance){
        isOptimalStrategyFoundCounter++;
        strategyParamBoundsObject.strategyBounds = priorStrategyParamBounds;
        postStrategyBalance = priorPostStrategyBalance;
    }else {
        isOptimalStrategyFoundCounter = 0;
    }

    if(!postStrategyBalance) 
        throw new Error(`Balance not returned. It's ${postStrategyBalance}`);

    const indexToModify = strategySelectorForSymbol.testedStrategies.findIndex(str => str.strategy === strategyKey)
    if(indexToModify === -1)
        strategySelectorForSymbol.testedStrategies.push({ 
            strategy: strategyKey, 
            strategyParams: exactStrategyParams, 
            strategyParamBounds: strategyParamBoundsObject.strategyBounds,
            lastParamBoundsChanges: strategyParamBoundsObject.stratedyChanges,
            postTestingBalance: postStrategyBalance
        });
    else
        strategySelectorForSymbol.testedStrategies.splice(indexToModify, 1, { 
            strategy: strategyKey, 
            strategyParams: exactStrategyParams, 
            strategyParamBounds: strategyParamBoundsObject.strategyBounds,
            lastParamBoundsChanges: strategyParamBoundsObject.stratedyChanges,
            postTestingBalance: postStrategyBalance
        });
    
    if(strategySelectorForSymbol === defaultStrategySelector) 
        assignedStrategies.push(strategySelectorForSymbol);
        
    const testedStrategies = strategySelectorForSymbol.testedStrategies;
    if(testedStrategies && testedStrategies.every(str => str.postTestingBalance && str.postTestingBalance <= postStrategyBalance))
        strategySelectorForSymbol.optimalStrategy = getStrategyKey(ChosenStrategy);

    const finalAssignedStrategies = assignedStrategies.map(str => str.symbol === symbol ? strategySelectorForSymbol : str);
    await promises.writeFile(STRATEGY_PATH, JSON.stringify(finalAssignedStrategies, null, 2));
    if(priorStrategyParamValues && isOptimalStrategyFoundCounter === priorStrategyParamValues.length * 2){
        console.log('🔥')
        isOptimalStrategyFoundCounter = 0;
        return true;
    }
    else
        return false;
}

let BumpDirectionFlag = false;

const instantiateParamBounds = (chosenStrategy: StrategyType, strategyAlterationObject: IStrategyAlterationObject | undefined, priorStrategyParams: number[] | undefined): IStrategyAlterationObject => {
    const { UNCHANGED, BUMPED_UP_LOWER, BUMPED_DOWN_UPPER } = TestedStrategyRepresentation;
    const returnParams: IStrategyAlterationObject = { stratedyChanges: [], strategyBounds: [] };
    const strategyKey = getStrategyKey(chosenStrategy);

    if(strategyKey === 'hdl')
        return returnParams;

    if(!isKeyInDefaultParamBounds(strategyKey))
        throw new Error(`${strategyKey} is not a valid strategy key`);

    const boundsForStrategy = DefaultStrategyBounds[strategyKey];

    //Is the first time any strategy params are requiered
    if(!strategyAlterationObject)
        return {
            strategyBounds: boundsForStrategy,
            stratedyChanges: new Array(boundsForStrategy.length).fill(UNCHANGED)
        };

    const { strategyBounds, stratedyChanges } = strategyAlterationObject;

    let psp: number[]; //Typescript be yelling at me for no reason without this

    if(!priorStrategyParams)
        psp = boundsForStrategy.map(bnd => (bnd.Lower + bnd.Upper) / 2);
    else 
        psp = priorStrategyParams

    const indexOfLastChangedParam = stratedyChanges.findIndex(strat => strat !== UNCHANGED);
    const nextParamToChangeIndex = (indexOfLastChangedParam + 1) % stratedyChanges.length;

    if(priorStrategyParams && indexOfLastChangedParam === priorStrategyParams.length - 1)
        BumpDirectionFlag = !BumpDirectionFlag;

    if(BumpDirectionFlag)
        return {
            stratedyChanges: new Array(boundsForStrategy.length).fill(0).map((_, i) => i === nextParamToChangeIndex ? BUMPED_UP_LOWER : UNCHANGED),
            strategyBounds: strategyBounds.map((s, i) => i === nextParamToChangeIndex ? { Lower: (s.Lower + psp[i]) / 2, Upper: s.Upper } : s)
        }
    else
        return {
            stratedyChanges: new Array(boundsForStrategy.length).fill(0).map((_, i) => i === nextParamToChangeIndex ? BUMPED_DOWN_UPPER : UNCHANGED),
            strategyBounds: strategyBounds.map((s, i) => i === nextParamToChangeIndex ? { Upper: (s.Upper + psp[i]) / 2, Lower: s.Lower } : s)
        } 
}

const getStrategyKey = (strategy: Strategies): string => {
    const strategyKeys = Object.keys(SavableStrategyLabels)
    if(!isKeyArrayVaild(strategyKeys)) 
        throw new Error(`${JSON.stringify(strategyKeys)} is not a valid key array`);

    const chosenStrategyKey = strategyKeys.find(key => SavableStrategyLabels[key] === strategy);
    if(!chosenStrategyKey) 
        throw new Error('Chosen strategy returned undefined');
    
    return chosenStrategyKey;
}

const isKeyArrayVaild = (codons: string[]): codons is Array<keyof typeof SavableStrategyLabels> => {
    return codons.every(isKeyInTheArray);
}
const isKeyInTheArray = (value: string): value is keyof typeof SavableStrategyLabels => {
    return value in SavableStrategyLabels;
}

const choseStrategy = (symbol: string, assignedStrategies: IStrategySelector[]): Strategies | undefined => {
    const defaults = [
        BB_Breakout_Strategy,
        MA_Cross_Strategy,
        RSI_Strategy,
        HODL_Strategy
    ]
    
    const assignedStrategy = assignedStrategies.find(str => str.symbol === symbol);
    if(!assignedStrategy)
        return defaults[Math.floor(Math.random() * defaults.length)];
    else if(assignedStrategy.testedStrategies.length === defaults.length)
        return defaults[2];
    else for(const i in defaults)
        if(assignedStrategy.testedStrategies.every(str => str.strategy !== getStrategyKey(defaults[i])))
            return defaults[i];

    console.log(assignedStrategy.testedStrategies.length, defaults.length)

    throw new Error('Unhandeled case in choseStrategy');
}

const DefaultStrategyBounds: IStrategyParamBounds = {
    bb: [{ Lower: 3, Upper: 20 }, { Lower: 0.05, Upper: 0.2 }, { Lower: 1, Upper: 10 }],
    ma: [{ Lower: 3, Upper: 16 }, { Lower: 20, Upper: 49 }],
    rsi: [{ Lower: 5, Upper: 30 }, { Lower: 0, Upper: 65 }, { Lower: 40, Upper: 100 }]
}

const instantiateStrategy = (Strategy: Strategies, Params: number[]): BB_Breakout_Strategy | MA_Cross_Strategy | RSI_Strategy | HODL_Strategy => {
    switch(Strategy){
        case BB_Breakout_Strategy || RSI_Strategy:
            return new Strategy(Params[0], Params[1], Params[2]);
        case MA_Cross_Strategy: 
            return new Strategy(Params[0], Params[1]);
        case HODL_Strategy:
            return new HODL_Strategy();
        default: 
            throw new Error('Unknown strategy to instantiate');
    }
}
