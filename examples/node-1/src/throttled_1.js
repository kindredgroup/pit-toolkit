
const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};
async function throttle_call(numOfCalls, task) {

  const startTime = new Date();
  const calls = numOfCalls;
  let promises = [];
  for (let i = 0; i < calls; i++) {
    promises.push(
      new Promise(async resolved => {
        let outcome = await task();
        resolved(outcome);
      })
    );
    // if (i == calls/2) {
    //     // Rate drops by 200/s with this sleep
    //   await sleep(0);
    // }
  }
  /**
   * When I dont have the try block of promise all without batching
   * node:internal/deps/undici/undici:11576
    Error.captureStackTrace(err, this);
          ^

TypeError: fetch failed
    at Object.fetch (node:internal/deps/undici/undici:11576:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async task (file:///Users/amnkau/code/kindred_github/pit-toolkit/examples/node-1/src/throttled_1.js:60:3)
    at async file:///Users/amnkau/code/kindred_github/pit-toolkit/examples/node-1/src/throttled_1.js:13:23 {
  cause: AggregateError
      at internalConnectMultiple (node:net:1114:18)
      at afterConnectMultiple (node:net:1667:5) {
    code: 'ETIMEDOUT',
    [errors]: [
      Error: connect ETIMEDOUT ::1:62001
          at createConnectionError (node:net:1634:14)
          at Timeout.internalConnectMultipleTimeout (node:net:1685:38)
          at listOnTimeout (node:internal/timers:575:11)
          at process.processTimers (node:internal/timers:514:7) {
        errno: -60,
        code: 'ETIMEDOUT',
        syscall: 'connect',
        address: '::1',
        port: 62001
      },
      Error: connect ECONNRESET 127.0.0.1:62001
          at createConnectionError (node:net:1634:14)
          at afterConnectMultiple (node:net:1664:40) {
        errno: -54,
        code: 'ECONNRESET',
        syscall: 'connect',
        address: '127.0.0.1',
        port: 62001
      }
    ]
  }
}
   */
  try {
    console.log("Promises: ",promises.length)
    if (promises.length > 500){
        while (true){
            // batch size can be played with not sure what the network 
            let batchPromise = promises.slice(0,500)
            promises.splice(0,500)
            await Promise.all(batchPromise);
            if (promises.length == 0){
                break
            }
            else{
                // Rate drops by 4000/s with this else block
                await sleep(0);
                continue
            }
           
        }
        
    }else{
      await Promise.all(promises);
      // console.log("single promis all Outcome: ",outcome)
    }
    
  }catch(err){
    console.log("Error: ",err)
  }finally{
    console.log("Finally")
    const timeElapsed =  (new Date()- startTime)/1000;
    console.log(`Time elapsed: ${timeElapsed} s`);
    const rate = calls / timeElapsed;
    console.log(`Rate: ${rate} calls/s`);
  }
}

const task = async () => {
  const targetServiceUrl = "http://localhost:62001"
  const endpoint = `${ targetServiceUrl }/addTask`
  await fetch(endpoint,{
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
   
  });
}

throttle_call(5000, task);