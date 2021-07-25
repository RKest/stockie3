import { IStockData } from '../stocks/stockPrices';

export enum bolingerBandsEnum {
    Lower = 0,
    Upper = 1
}

export const averageData = (stockData: IStockData): number => {
    return (+stockData.close + +stockData.open) / 2
}

export const getMovingAverage = (averageArray: number[], movingAverageLength: number): number => {
    averageArray = averageArray.slice(0, movingAverageLength)
    return averageArray.reduce((a, b) => a + b, 0) / averageArray.length;
}

export const getBollingerBand = (averageArray: number[], bbLength: number, direction: bolingerBandsEnum.Lower | bolingerBandsEnum.Upper, numberOfDeviations: number = 2): number => {
    const movingAverage = getMovingAverage(averageArray, bbLength);
    averageArray = averageArray.slice(0, bbLength);
    const standardDeviation: number =  Math.sqrt(averageArray.map(x => Math.pow(x - movingAverage, 2)).reduce((a, b) => a + b) / averageArray.length);
    const totalDeviation = numberOfDeviations * standardDeviation
    return direction === bolingerBandsEnum.Lower ? movingAverage - totalDeviation : movingAverage + totalDeviation;
}

export const getRSI = (averageArray: number[], rsiLength: number = 14): number => {
    averageArray = averageArray.slice(0, rsiLength);
    const upMoveArray: number[] = [];
    const downMoveArray: number[] = [];
    for(const averageIndex in averageArray){
        if(!averageArray[Number(averageIndex) + 1]) break;
        const stockDifference = averageArray[Number(averageIndex)] - averageArray[Number(averageIndex) + 1];
        upMoveArray.push(stockDifference < 0 ? Math.abs(stockDifference) : 0);
        downMoveArray.push(stockDifference < 0 ? 0 : Math.abs(stockDifference));
    }
    const avgU = upMoveArray.reduce((a: number, b: number) => a + b) / upMoveArray.length;
    const avgD = downMoveArray.reduce((a: number, b: number) => a + b) / downMoveArray.length;
    const RS = avgU / avgD;
    return 100 - (100 / (1 + +RS));
}