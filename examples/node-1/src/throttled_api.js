
const API = async(params)=> {
    console.log("API called")
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callAPI(params) {

    var countCalls = 50
    var startTime = new Date().getTime()
    // console.log("callAPI : Start time: "+startTime)
    var endTime = startTime + 1000;
    let counter =0
    // while (countCalls > 0 && new Date().getTime() < endTime ) {
        while (countCalls > 0 ){
        console.log("counter: "+ countCalls)
        // Promise.resolve(API(params))
        await API(params)
        // submit(await API(params))
        countCalls--
    }
    var endTime = new Date().getTime()
    if((endTime-startTime)/1000 > 1) {
        console.log("Time taken: "+(endTime-startTime)/1000)
        console.log("Need adjustments in the code")
    }
    // console.log("End of callAPI", )
    sleep(0)
}

async function main(params) {
    var startTime = new Date().getTime()
    console.log("Start time: "+startTime)
    var endTime = startTime + 8;
    // console.log("End time: "+endTime)
    // var countCalls = endTime-startTime;

   
    let count = 0
    let sustainedRateForTime = 1
    // run all testPromise in parallel
    // setInterval(() => {
    //     console.log("Interval")
    //     let results = Promise.all(backlog.map(func => func()));
    // }
     while (new Date().getTime() < endTime) {
        //  --countCalls
        //  console.log("countine",count++, countCalls)
        // Promise.resolve( callAPI())
        await callAPI()
     }
    
     var endMain = new Date().getTime()
     console.log("*******************End of main************",endMain-startTime,"ms")
}

await main()
