export {
    uniqifyStocks
}

const uniqifyStocks = (symbols: string[][]) => {
    let finalSymoblArray: string[] = [];
    for(const symbolArray of symbols){
        const newAdditions = symbolArray.filter(symbol => !finalSymoblArray.includes(symbol))
        finalSymoblArray = [...finalSymoblArray, ...newAdditions]; 
    }

    return finalSymoblArray;
}
