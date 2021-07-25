import puppeteer from 'puppeteer';
import { scrape, filterStockSymbols, IMiniStockDataObject } from "./scraping";
import { formSchedule, isMarketOpen } from './scheduler'
import * as params from './tvParams'
import { StockDataObject, IStockData } from "../stocks/stockPrices";
import { promises } from 'fs';

const LARGEST_LENGTH_NEEDED_FOR_STRATEGY_EVALUATION = 50;

export default class Scanner {
    historyStockDataPath = __dirname + '/_historicPrices.json';
    browser: puppeteer.Browser | undefined;
    page: puppeteer.Page | undefined;

    async launch() {
        this.browser = await puppeteer.launch({
            executablePath: params.EXE_PATH,
            headless: true,
            args: params.FLAGS,
            handleSIGINT: false,
            defaultViewport: {height: 3000, width: 1700}
        });
        this.page = await this.browser.newPage();

        await this.page.setCookie(...params.COOKIES());
        await this.page.goto(params.TV_URL, { waitUntil: 'networkidle2' });
    }

    async scan(symbols: string[]): Promise<StockDataObject[]>{
        if(!this.page || !this.browser) throw new Error('Lanuch scanner using launchScanner() method');
        const miniStockData = await this.evaluate(symbols);
        console.log('👀');
        const openMiniStockData = miniStockData.filter(stock => isMarketOpen(formSchedule(stock.symbol)));

        return await this.updateHistoricStockData(openMiniStockData);
    }    

    private async evaluate(symbols: string[]): Promise<IMiniStockDataObject[]> {
        if(!this.page || !this.browser) throw new Error('Lanuch scanner using launchScanner() method');
        const root = await this.page.evaluate(() => document.querySelector('.listContainer-1OhjZIMS')?.innerHTML) || 'err';
        if(root === 'err') throw new Error('No stocks found while evaluating TradingView');
        
        const scrapedContent = await scrape(root);
    
        return filterStockSymbols(scrapedContent, symbols);;
    }

    private async getHistoricStockData(symbol: string, stockDataArray: StockDataObject[]): Promise<StockDataObject> {
        let dataForSymbol = stockDataArray.find(stock => stock.symbol === symbol);
        if(!dataForSymbol)
            throw new Error(`No data for symbol ${symbol}`)
    
        dataForSymbol.data = dataForSymbol.data.slice(0, LARGEST_LENGTH_NEEDED_FOR_STRATEGY_EVALUATION);
        return dataForSymbol;
    }

    private async updateHistoricStockData(miniStockData: IMiniStockDataObject[]) {      
        const stockDataArray: StockDataObject[] = JSON.parse(await promises.readFile(this.historyStockDataPath, 'utf-8'));

        for (const data of miniStockData) {
            const { symbol, price } = data;
            const historicData = await this.getHistoricStockData(symbol, stockDataArray);
    
            const derivedPrices = this.deriveAproximatePrices(price);
            historicData.data.unshift(derivedPrices);
            historicData.data.pop();

            const depricatedStockData = stockDataArray.find(stock => stock.symbol === symbol);

            if(!depricatedStockData || stockDataArray.indexOf(depricatedStockData) === -1)
                throw new Error(`Cannot find data for symbol ${symbol}`);

            stockDataArray.splice(stockDataArray.indexOf(depricatedStockData), 1, historicData)
        }

        await promises.writeFile(this.historyStockDataPath, JSON.stringify(stockDataArray, null, 2));
        return stockDataArray;
    }

    private deriveAproximatePrices(openPrice: number): IStockData {
        return {
            close: +((openPrice * 0.999).toPrecision(4)),
            open: openPrice
        }
    }

    async close(){
        for(const page of await this.browser?.pages() || []){
            page.close();
        }
        this.browser?.close();
    }
}


export const initiateHistoricData = async (stockData: StockDataObject) => {
    const stockDataArray: StockDataObject[] = JSON.parse(await promises.readFile(__dirname + '/_historicPrices.json', 'utf-8'));
    if(stockDataArray.find(stock => stock.symbol === stockData.symbol))
        return;

    stockData.data = stockData.data.slice(0, LARGEST_LENGTH_NEEDED_FOR_STRATEGY_EVALUATION);
    stockDataArray.push(stockData);
    await promises.writeFile(__dirname + '/_historicPrices.json', JSON.stringify(stockDataArray, null, 1));
}




