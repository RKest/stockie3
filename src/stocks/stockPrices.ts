import { promises, readFileSync } from 'fs';
import Stocks, { Interval } from '../api/api';
const Alpha = new Stocks('TXJNHZM01XQZHA1Q');

enum PricesStrings {
  open = '1. open',
  high = '2. high',
  low = '3. low',
  close = '4. close'
}

export {
  ISimpleStockData as ISimpleStockDataObject,
  IStockData,
  StockDataObject,
  PricesStrings,
  IReducedStockData,
  getStockSymbols,
  getStockSymbolsSync,
  getStockExchange,
  getStockExchangeSync,
  getStockData
}

interface IReducedStockData {
  symbol: string;
  data: number[];
  earliestTime: string;
  latestTime: string;
}

interface ISimpleStockData {
  symbol: string;
  data: number[];
  escaped?: boolean;
}

interface IStockData {
  open: number,
  close: number
}

type StockDataObject = {
  symbol: string;
  data: IStockData[];
}

async function getStockSymbols(): Promise<string[]> {
  const nyseStocks: string[] = JSON.parse(await promises.readFile(__dirname + '/_nyseStocks.json', 'utf-8'));
  const londonStocks: string[] = JSON.parse(await promises.readFile(__dirname + '/_londonStocks.json', 'utf-8'));
  const stocks: string[] = [...nyseStocks, ...londonStocks];
  return stocks;
}

function getStockSymbolsSync(): string[] {
  const nyseStocks: string[] = JSON.parse(readFileSync(__dirname + '/_nyseStocks.json', 'utf-8'));
  const londonStocks: string[] = JSON.parse(readFileSync(__dirname + '/_londonStocks.json', 'utf-8'));
  const stocks: string[] = [...nyseStocks, ...londonStocks];
  return stocks;
}

async function getStockExchange(symbol: string) {
  const nyseStocks: string[] = JSON.parse(await promises.readFile(__dirname + '/_nyseStocks.json', 'utf-8'));
  const londonStocks: string[] = JSON.parse(await promises.readFile(__dirname + '/_londonStocks.json', 'utf-8'));
  if (nyseStocks.includes(symbol)) return 'NYSE';
  if (londonStocks.includes(symbol)) return 'LONDON';
  throw new Error(`Stock ${symbol} does not appear in any local exchange database`);
}

function getStockExchangeSync(symbol: string) {
  const nyseStocks: string[] = JSON.parse(readFileSync(__dirname + '/_nyseStocks.json', 'utf-8'));
  const londonStocks: string[] = JSON.parse(readFileSync(__dirname + '/_londonStocks.json', 'utf-8'));
  if (nyseStocks.includes(symbol)) return 'NYSE';
  if (londonStocks.includes(symbol)) return 'LONDON';
  throw new Error(`Stock ${symbol} does not appear in any local exchange database`);
}

async function getStockData(symbol: string): Promise<StockDataObject | null> {
  try {
    const stockData = await Alpha.requestStockIntraday(symbol);
    return toStockDataObject(stockData);
  } catch (err) {
    console.log(err);
    return null;
  }
}

const toStockDataObject = (data: any): StockDataObject => {
  const parsedData = JSON.parse(data['body']);
  if (!parsedData['Meta Data']) {
    throw new Error(JSON.stringify(parsedData, null, 1))
  }
  const keysArray = Object.keys(parsedData).map(key => key);
  const timeArray: any[] = parsedData[keysArray[1]];

  const priceArray: IStockData[] = timeArray.map(tao =>
  ({
    open: +tao[PricesStrings.open],
    close: +(+tao[PricesStrings.open] * 0.999).toFixed(4)
  }));

  const symbol = parsedData['Meta Data']['2. Symbol'];
  if (!symbol)
    throw new Error(JSON.stringify(parsedData, null, 1))

  return {
    symbol: symbol,
    data: priceArray
  }
}