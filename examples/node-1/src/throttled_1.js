
const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};
async function throttle_call() {

  const startTime = new Date();
  const calls = 50000;
  let promises = [];
  for (let i = 0; i < calls; i++) {
    promises.push(
      new Promise(async resolved => {
        await sleep(1000);
        resolved();
      })
    );
    // if (1 == calls - 1) {
    //     // Rate drops by 200/s with this sleep
    //   await sleep(10);
    // }
  }
  try {
    if (promises.length > 500){
        while (true){
            // batch size can be played with not sure what the network 
            let batchPromise = promises.slice(0,500)
            promises.splice(0,500)
            await Promise.all(batchPromise);
            if (promises.length == 0){
                break
            }else{
                // Rate drops by 4000/s with this else block
                await sleep(0);
                continue
            }
           
        }
        
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

throttle_call();