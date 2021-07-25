import { readFileSync, writeFileSync } from "fs";

interface IMockPortfolioElement {
    symbol: string;
    amount: number;
}

interface IMockPortfolio {
    balnace: number;
    portfolio: IMockPortfolioElement[];
}

export default class Brokerage {
    readonly mockPortfolioPath = __dirname + '/_mockPortfolio.json';
    mockPortfolio: IMockPortfolio;
    constructor() {
        this.mockPortfolio = JSON.parse(readFileSync(this.mockPortfolioPath, 'utf-8'));
    }

    buy(symbol: string, amount: number, unitPrice: number) {
        const totalPrice = amount * unitPrice;
        const portfolioElementIndex = this.mockPortfolio.portfolio.findIndex(el => el.symbol === symbol);

        if (this.mockPortfolio.balnace < totalPrice) {
            console.log(`Not enough balance to purchase "${symbol}"`);
            return;
        }

        if (portfolioElementIndex === -1) {
            const newPortfolioElement: IMockPortfolioElement = { symbol, amount };
            this.mockPortfolio.balnace -= totalPrice;
            this.mockPortfolio.portfolio.push(newPortfolioElement);
            return;
        }

        this.mockPortfolio.portfolio[portfolioElementIndex].amount += amount;
    }

    sell(symbol: string, amount: number, unitPrice: number) {
        const totalPrice = amount * unitPrice;
        const portfolioElementIndex = this.mockPortfolio.portfolio.findIndex(el => el.symbol === symbol);

        if (this.mockPortfolio.balnace < totalPrice) {
            console.log(`Not enough balance to purchase "${symbol}"`);
            return;
        }

        if (portfolioElementIndex === -1) {
            const newPortfolioElement: IMockPortfolioElement = { symbol, amount };
            this.mockPortfolio.balnace -= totalPrice;
            this.mockPortfolio.portfolio.push(newPortfolioElement);
            return;
        }

        this.mockPortfolio.portfolio[portfolioElementIndex].amount += amount;
    }

    save() {
        writeFileSync(this.mockPortfolioPath, JSON.stringify(this.mockPortfolio, null, 2));
    }
}