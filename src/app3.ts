import express from 'express';
import { getHistoricPrices } from './scanning/scraping';
import { getStockData } from './stocks/stockPrices';
import { promises } from 'fs';
import { Organiser, Parser, PathFinder } from './data/data';

const app = express();
app.use(express.static(__dirname + '/client'));

// (async () => {
//     const paths = await new PathFinder().traverse();
//     const parser = new Parser();
//     // const organiser = new Organiser();
//     await parser.parse(paths);
//     await parser.save();
//     // organiser.transfer();
// })();

app.get('/prices', async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol || typeof symbol !== 'string') {
        res.statusCode = 400;
        res.send('Specify a symbol');
        return;
    }

    const stockData = await getStockData(symbol)
    // const historicPrices = getHistoricPrices();
    // const histociPriceForSymbol = historicPrices.find(el => el.symbol === symbol);

    if (!stockData) {
        res.statusCode = 404;
        res.send('No historic price');
        return;
    }


    res.statusCode = 200;
    //res.json(histociPriceForSymbol.data.map(el => el.open));
    const data = stockData.data.map(el => el.open).reverse();
    res.json(data)
});

app.get('/chartData', async (req, res) => {
    const netNum = req.query.netNum;
    const modelDataString: string = await promises.readFile(__dirname + `/aiII/slope-model-${netNum}.log`, 'utf-8');
    const modelData = modelDataString.split('\n');
    const modelVariables = modelData.map(str => str.split(','));
    const modelGropus: any[][] = Array.from(Array(4), () => [])
    const DATA_POINTS_AMOUNT = 100;
    const modelIncrement = Math.floor(modelVariables.length / DATA_POINTS_AMOUNT);
    for(var i = 0; i < modelVariables[0].length - 3; i++)
        for(var j = 0; j < modelVariables.length; j += modelIncrement)
            modelGropus[i].push(avgerageArray(modelVariables.slice(j, j + modelIncrement).map(el => el[i + 3])))
        
    res.json(modelGropus);
});

app.get('/chart', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

const avgerageArray = (arr: string[]): number => arr.map(Number).reduce((acc, el) => acc + el, 0) / arr.length

// writeDataFromCSV()
app.listen(8080, () => console.log('listening on 8080'));


// (async function(){
//     const modelDataString: string = await promises.readFile(__dirname + '/aiII/model.log', 'utf-8');
//     const modelData = modelDataString.split('\n');
//     const modelVariables = modelData.map(str => str.split(','));
    
// })()

// let sRange = 100, lRange = 2000, rand = () => randomInt(sRange), tab = [];
// for(;sRange < lRange; sRange += 100){
//     let i = 0;
//     for(let r = randomInt(sRange); r === rand(); i++)
//         continue
//     tab.push(i)
// }
// console.log(tab)

