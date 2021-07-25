import puppeteer from "puppeteer";
import * as params from './etParams';
import { StrategyType } from "../strategies/strategies";
import { promisify } from "util";
const sleep = promisify(setTimeout);

export default class Borkarage {
    private browser: puppeteer.Browser | undefined;
    private page: puppeteer.Page | undefined;
    private maxPortfolioLength: number;
    private portfolioBalance = -1;

    constructor(maxPortfolioLength: number){
        this.maxPortfolioLength = maxPortfolioLength;
    }

    async launch(){
        this.browser = await puppeteer.connect({
            browserWSEndpoint: params.WS_EDP,
            defaultViewport: {height: 1080, width: 1700}
        });
        this.page = await this.browser.newPage();
        await this.page.goto(params.PF_URL, { waitUntil: 'networkidle2' });
        this.portfolioBalance = await this.getBalance();
    }

    async buySymbol(symbol: string, portfolioLength: number): Promise<boolean> {
        const TRADE_BUTTON = 'trade-button';
        const EXE_BUTTON = '.execution-button';
        const AMOUNT_TEXTBOX = '[data-etoro-automation-id="input"]'

        symbol = symbol.toLowerCase();
        if(!this.browser) throw new Error('Launch brokerage by awaiting launchBrokerage() method');
        const page = await this.browser.newPage();
        try{
            await page.goto(params.BR_URL + symbol);
            await page.waitForSelector(TRADE_BUTTON, { visible: true, timeout: 5000 });
            while (true){
                if(await page.$(EXE_BUTTON))
                    break;
                await page.click(TRADE_BUTTON);
                await sleep(200); 
            }
            await sleep(1000);
            await page.focus(AMOUNT_TEXTBOX)
            await page.evaluate((sel) => document.querySelector(sel).value = "", AMOUNT_TEXTBOX)
            await sleep(200);
            const amount = await this.setAmount(portfolioLength);
            await page.keyboard.type(`${amount}`);
            await sleep(400);
            await page.click(EXE_BUTTON);
            await sleep(1500);
            await page.click(EXE_BUTTON);
            await sleep(1500);
            page.close();
            return true;
        }
        catch{
            page.close();
            return false;
        }
    }

    async sellSymbol(symbol: string): Promise<boolean> {
        const CLOSE_BUTTON = '[data-etoro-automation-id="open-trades-table-body-cell-user-actions-close-button"]';
        const EXE_BUTTON = '[data-etoro-automation-id="close-position-close-button"]';

        symbol = symbol.toLowerCase();
        if(!this.browser) throw new Error('Launch brokerage by awaiting launchBrokerage() method');
        const page = await this.browser.newPage();
        try{
            await page.goto(params.PF_URL + symbol);
            await page.waitForSelector(CLOSE_BUTTON, { visible: true, timeout: 5000 });
            await page.click(CLOSE_BUTTON);
            while(true){
                if(await page.$(EXE_BUTTON))
                    break;
                await page.click(CLOSE_BUTTON);
                await sleep(200);
            }
            await sleep(1000);
            await page.click(EXE_BUTTON);
            await sleep(1000);

            const HEADER = `[ng-include="'/etoro/apps/trader/portfolio/detailedView/header/header.view.html'"]`;
            while(true){
                if(!await page.evaluate((sel) => sel?.innerHTML || false, HEADER))
                    break;
                await sleep(200);
            }
            await sleep(1000);
            this.portfolioBalance = await this.getBalance();
            await sleep(1000);
            page.close();
            return true;
        }
        catch {
            page.close();
            return false;
        }
    }
    
    private async getBalance(): Promise<number>{
        const AVAILABLE_BALANCE_SPAN = '[automation-id="account-balance-availible-unit-value"]';
        if(!this.page) 
            throw new Error('Launch brokerage by awaiting launchBrokerage() method');

        const balanceValue: string = await this.page.evaluate((sel) => document.querySelector(sel)?.innerHTML || 'err', AVAILABLE_BALANCE_SPAN);

        if(balanceValue === 'err')
            throw new Error('Balance could not be found');

        return +balanceValue.replace('$', '').replace(',', '');
    }

    private async setAmount(portfolioLength: number): Promise<number>{
        const amount = Math.floor(this.portfolioBalance / (this.maxPortfolioLength - portfolioLength + 1));
        this.portfolioBalance -= amount;
        return amount;
    }


}

