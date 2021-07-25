import { getStockExchangeSync } from "../stocks/stockPrices";
import { promisify } from "util";
const sleep = promisify(setTimeout);

export{
    formSchedule,
    isMarketOpen,
    delayMarketScanning
};

interface IDayTime{
    hour: number;
    minute: number;
};

interface IOpenExchangeHours{
    exchange: string;
    open: IDayTime;
    close: IDayTime;
};

const NYSE_TRADING_HOURS: IOpenExchangeHours = {
    exchange: 'NYSE',
    open: {
        hour: 15,
        minute: 30
    },
    close: {
        hour: 22,
        minute: 0
    }
};

//Too much paint to implement
const LONDON_TRADING_HOURS: IOpenExchangeHours = {
    exchange: 'LONDON',
    open: {
        hour: 8,
        minute: 0
    },
    close: {
        hour: 8,
        minute: 1
    }
};

const formSchedule = (symbol: string): IOpenExchangeHours => {
    const stockExchange = getStockExchangeSync(symbol);
    return stockExchange === 'NYSE' ? NYSE_TRADING_HOURS : LONDON_TRADING_HOURS;
}

const isMarketOpen = (exchHours: IOpenExchangeHours): boolean => {
    const time = new Date();
    const hourExp = time.getHours();
    const minuteExp = time.getMinutes();

    if  ((hourExp > exchHours.open.hour || (hourExp === exchHours.open.hour && minuteExp >= +exchHours.open.minute)) && 
        (hourExp < exchHours.close.hour)) return true;
    return false;
}

const delayMarketScanning = async (exchHours: IOpenExchangeHours, minuteOffset = 0) => {
    const time = new Date();
    const hourExp = time.getHours();
    const minuteExp = time.getMinutes();
    const secondExp = time.getSeconds();

    const { hour, minute } = exchHours.open;
    
    const hourDiff = hour - hourExp;
    const minuteDiff = minute - minuteExp;

    if(!isMarketOpen(exchHours)){
        console.log('🕒');
        console.log(hourDiff*3600 + minuteDiff*60 + minuteOffset*60 - secondExp);
        await sleep((hourDiff*3600 + minuteDiff*60 + minuteOffset*60 - secondExp) * 1000);
    }else{
        console.log('🕒');
        console.log(((5 - (minuteExp % 5)) * 60) - secondExp);
        await sleep((((5 - (minuteExp % 5)) * 60) - secondExp) * 1000);
    }

    
}
