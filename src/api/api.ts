import request from 'request';
import { promisify } from 'util';
const baseUri = 'https://www.alphavantage.co/query?function=';
const get = promisify(request.get);
const sleep = promisify(setTimeout);

enum Market{
    Stocks = 'TIME_SERIES',
    Crypto = 'DIGITAL_CURRENCY',
    Forex = 'FX'
}

export enum Interval{
    Intraday = '_INTRADAY',
    Daily = '_DAILY',
    DailyAdjusted = '_DAILY_ADJUSTED',
    Weekly = '_WEEKLY',
    WeeklyAdjusted = '_WEEKLY_ADJUSTED',
    Monthly = '_MONTHLY',
    MonthlyAdjusted = '_MONTHLY_ADJUSTED'
}

export enum IntradatInterval{
    min =  "1min",
    five = "5min",
    fifteen = "15min",
    thirty = "30min",
    hour = "60min"
}

enum OutputSize{
    full = 'full',
    compact = 'compact'
}

export default class Stocks {
    private apiKey: string;
    private stockTimeoutCounter: number = 0;
    constructor(key: string){
        this.apiKey = key
    }

    async requestStockIntraday(symbol: string, intradayInterval: IntradatInterval = IntradatInterval.five): Promise<any>{
        await this.getTimeout();
        const reqUri = baseUri + Market.Stocks + Interval.Intraday + 
        '&symbol=' + symbol + 
        '&interval=' + intradayInterval +
        '&outputsize=' + OutputSize.full + 
        '&apikey=' + this.apiKey;
        return await get({url: reqUri});
    }

    async requestStockDaily(symbol: string): Promise<any>{
        await this.getTimeout();
        const reqUri = baseUri + Market.Stocks + Interval.Intraday + 
        '&symbol=' + symbol + 
        '&outputsize=' + OutputSize.full + 
        '&apikey=' + this.apiKey;
        return await get({url: reqUri});
    }

    async requestFx(from: string, to: string, interval: Interval, intradayInterval: IntradatInterval = IntradatInterval.hour): Promise<any>{
        await this.getTimeout();
        const reqUri = baseUri + Market.Forex + interval + 
        '&from_symbol=' + from + 
        '&to_symbol=' +  to + 
        '&interval=' + intradayInterval +
        '&outputsize=' + OutputSize.full + 
        '&apikey=' + this.apiKey;
        return await get({url: reqUri});
    }

    async getTimeout(): Promise<void>{
        if(++this.stockTimeoutCounter % 5 !== 0) return;
        else{
            this.stockTimeoutCounter = 0;
            //console.log('Timeout');
            console.log('Timeout')
            await sleep(120000);
            return;
        }
    }
}
