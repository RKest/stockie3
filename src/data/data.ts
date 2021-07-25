import { createWriteStream, promises } from "fs";
import { resolve } from "path";

export {
    Parser,
    PathFinder,
    Organiser
}

const trainPath = __dirname + '/_txtData.json';
const testPath = __dirname + '/_txtTestData.json';

class PathFinder {
    private paths: string[] = [];
    private ROOT_DIR = __dirname + '/5_us_txt';

    /**
     * Top level traversion
     * Returns all files recuresevely in a directory
     */
    public async traverse(dir = this.ROOT_DIR) {
        const dirsOrFiles = await promises.readdir(dir);
        for (const dirOfFile of dirsOrFiles) {
            const resolvedDirOrFile = resolve(dir, dirOfFile);
            const fileOrDirStat = await promises.stat(resolvedDirOrFile);
            if (fileOrDirStat && fileOrDirStat.isDirectory()) {
                await this.traverse(resolvedDirOrFile);
            }
            else if (fileOrDirStat) {
                this.paths.push(resolvedDirOrFile);
            }
        }

        return this.paths;
    }

}


class Parser {
    private jsonData: number[][] = [];
    /**
     * Takes a path of a txt file and returns price array
     */
    public async parse(pathArr: string[]) {
        const lastPathIndex = pathArr.length - 1;
        for (const path of pathArr) {
            const fileString = await promises.readFile(path, 'utf-8');
            const openPrices = fileString.split('\n').slice(1, -1).map(line => Number(line.split(',')[4]));
            if (openPrices.length > 50)
                this.output(openPrices);
        }
    }
    /**
     * Save the accumulated data
     */
    public async save() {
        await promises.writeFile(trainPath, JSON.stringify(this.jsonData, null, 2));
        console.log('saved');
    }

    private async output(array: number[]) {
        this.jsonData.push(array);
    }
}

class Organiser {
    /**
     * Transfers some of the data from train data to be used for test data
     */
    public async transfer(amountOfSymbols = 50) {
        const trainData: number[][] = JSON.parse(await promises.readFile(trainPath, 'utf-8'));
        const testData: number[][] = [];
        for (var i = 0; i < amountOfSymbols; i++){
            const r = Math.floor(Math.random() * trainData.length);
            const dataToTransfer = trainData.splice(r, 1);
            testData.push(dataToTransfer[0]);
        }

        await Promise.all([
            promises.writeFile(trainPath, JSON.stringify(trainData, null, 2)),
            promises.writeFile(testPath, JSON.stringify(testData, null, 2)),
        ]);

        console.log('Done');
    }
}