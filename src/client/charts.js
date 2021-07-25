$(function(){
    $('#submitButton').on('click', () => showPlot($('#netNum').val()))
})

const labelArray = ['slope_acc', 'slope_loss', 'slope_val_loss', 'slope_val_acc'];

function loadChart(res){
    const traceArr = []
    console.log(res)

    for(var i = 0; i < res.length; i++){
        const trace = {
            x: makeRange(res[i]),
            y: normalise(res[i], i),
            name: labelArray[i]
        }
        console.log(labelArray[i])
        traceArr.push(trace);
    }
    
    Plotly.newPlot('plotDiv', traceArr);
}

function showPlot(num){
    $.ajax({
        url: `/chartData?netNum=${num}`,
        success: (res) => loadChart(res),
        error: (err) => conosle.log(err)
    });

}

function makeRange(arr) {
    return new Array(arr.length - 1).fill(1).map((_, i) => i+1);
}

function normalise(arr, i) {
    const numberArr = arr.map(el => +el);
    const avg = arr.reduce((agr, val) => +agr + +val, 0) / numberArr.length;
    console.log(avg, i)
    if(avg > 1)
        return numberArr;
    else 
        return numberArr.map(el => el * 100);
}
