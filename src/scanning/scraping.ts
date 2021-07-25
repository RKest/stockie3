import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { StockDataObject } from '../stocks/stockPrices';

interface IMiniStockDataObject{
    symbol: string;
    price: number;
}

export {
    scrape,
    filterStockSymbols,
    IMiniStockDataObject,
    getHistoricPrices
}

const scrape = async (dom: string): Promise<IMiniStockDataObject[]> => {
    const symbolPriceArray: IMiniStockDataObject[] = [];
    const window = new JSDOM(dom).window;
    const $ = require('jquery')(window);
    $(dom)
        .find(':not(iframe)')
        .addBack()
        .contents()
        .filter(function(this: any){
            return $(this).attr('data-symbol-short') !== undefined;
        })
        .each(function(this: any){
            const symbol = $(this).attr('data-symbol-short');
            const price = $(this).children('span').first().text();
            if(!symbol || (!+price && +price !== 0)) throw new Error(`Symbol ${symbol} and/or price ${price} not found`)
            symbolPriceArray.push({
                symbol: symbol,
                price: +price
            })
        });
    return symbolPriceArray;
}

const filterStockSymbols = (miniStockDataObjectArray: IMiniStockDataObject[], symobls: string[]) =>
    miniStockDataObjectArray.filter(sdo => symobls.includes(sdo.symbol));

const getHistoricPrices = (): StockDataObject[] => JSON.parse(readFileSync(__dirname + '/_historicPrices.json', 'utf-8'));