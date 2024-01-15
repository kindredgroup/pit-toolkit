// function testPromise1(){
//     return new Promise((resolve, reject) => {
//         setTimeout(() => {
//             resolve('ok1');
//         }, 1000);
//     });
// }
// function testPromise2(){
//     return new Promise((resolve, reject) => {
//         setTimeout(() => {
//             resolve('ok2');
//         }, 100);
//     });
// }
// function testPromise3(){
//     return new Promise((resolve, reject) => {
//         setTimeout(() => {
//             resolve('ok3');
//         }, 10);
//     });
// }

// async function test(){
//     let live = 0;
//     let backlog = new Array();
//     // add testPromise to backlog
//     backlog.push(testPromise1);
//     backlog.push(testPromise2);
//     backlog.push(testPromise3);

//     // run all testPromise in parallel
//     let results = await Promise.all(backlog.map(func => func()));
//     // let res = await testPromise();
//     console.log(results);
// }

// test();


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var globalList = Array();
globalList.push("Test");
globalList.push("Another Test");

async function coreFunc(promiseName, sleepTime) {
    console.log("Started CoreFunc: "+promiseName);

    var localList = [...globalList];

    console.log("Length of local array: "+localList.length);
    console.log("Length of global array: "+globalList.length);

    if (promiseName != "Promise0") {
        for ( var i = 0; i < localList.length; i++) {
            console.log(localList[i]);
        }
    }

    if (promiseName == "Promise0") {
        var testList = new Array();
        testList[0] = "Changed";
        globalList = testList;
    }
    await sleep(sleepTime);

    console.log("Length of local array: "+localList.length);
    console.log("Length of global array: "+globalList.length);

    console.log("Done with CoreFunc: "+promiseName);
}

async function testMultiplePromises() {
    var thArray = Array();

    for ( var i = 0; i < 4; i++) {
        var pr = new Promise(resolve => coreFunc("Promise" + i, 3000));
        thArray[i] = pr;
    }

    for ( var i = 0; i < thArray.length; i++) {
        await thArray[i];
    }
}

testMultiplePromises()