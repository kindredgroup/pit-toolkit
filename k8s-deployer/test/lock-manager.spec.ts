// test lock manager API

import { assert } from "chai"
import esmock from "esmock";
import { describe, it } from "mocha";
import { logger } from "../src/logger.js";

describe("LockManager", () => {

    let lockMangerInstance 

    it("should acquire lock", async () => {
        let lockId = "id1";
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=> ({lockId,acquired: true})
            }
        });

         lockMangerInstance = new lockManager.LockManager("http://foobar:8080")
         lockMangerInstance.startKeepAliveJob = ()=>{}

        let resp = await lockMangerInstance.lock("owner", {ids: [lockId]});
        assert.deepEqual(resp,[ 'id1' ])
    })

    it("should throw error if lock is not acquired", async () => {
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=>  {throw new Error("Failed to acquire lock")}
            }
        });

         lockMangerInstance = new lockManager.LockManager("http://foobar:8080")

         try{
            await lockMangerInstance.lock("owner", {ids: ["id1", "id2"]});
         }catch(e){
             assert.deepEqual(e.message,"Failed to acquire lock for id1")
         }
    })

    it("should release lock", async () => {
        let mockIdList =["id1", "id2"];
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=> (mockIdList)
            }
        });

         lockMangerInstance = new lockManager.LockManager("http://foobar:8080")
         
        let resp = await lockMangerInstance.release("owner", mockIdList);
        assert.deepEqual(resp, mockIdList)
    })

    it("should throw error if lock is not released", async () => {
        let mockIdList =["id1", "id2"];
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=>  {throw new Error("Failed to release lock")}
            }
        });

         lockMangerInstance = new lockManager.LockManager("http://foobar:8080")
         
         try{
            const waitInterval= await lockMangerInstance.release("owner", {ids:mockIdList});
            logger.info(`should not reach here ${waitInterval}`)
         }catch(e){
             assert.equal(e.message,"Failed to release lock for id1,id2")
         }
    })
})