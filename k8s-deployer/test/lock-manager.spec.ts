// test lock manager API

import { assert, expect } from "chai"
import esmock from "esmock";
import { describe, it } from "mocha";
import { logger } from "../src/logger.js";
import Sinon from "sinon";

describe("LockManager", () => {

    let lockMangerInstance 

    it("should acquire and release lock", async () => {
       
        let lockId = "id1";
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=> ({lockId,acquired: true})
            }
        });

        lockMangerInstance = new lockManager.LockManager("http://foobar:8080")
        let resp = await lockMangerInstance.lock("test-graph", {ids: [lockId]});
        await lockMangerInstance.release("test-graph", {ids: [lockId]})
        assert.deepEqual(resp,[ 'id1' ])
       
    })

    it("should test invalid timout", async () => {
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=> ({lockId:"id1",acquired: true}),
                // apiFetch: ()=> ({lockId:"id1",acquired: true})
            }
        });

         lockMangerInstance = new lockManager.LockManager("http://foobar:8080")
        let timeout = 0;
        try{
            await lockMangerInstance.lock("test-graph", {ids: ["id1"], timeout});
        }catch(e){
            logger.info("**************",e)
            assert.equal(e.message,`LockManager.validateParams(): timeout ${timeout} should be a string eg 1h, 1m or 1s`)
        }
    })

    it("should throw error if lock is not acquired", async () => {
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=>  {throw new Error("Failed to acquire lock")}
            }
        });

         lockMangerInstance = new lockManager.LockManager("http://foobar:8080")

         try{
            await lockMangerInstance.lock("test-graph", {ids: ["id1", "id2"]});
         }catch(e){
             assert.deepEqual(e.message,"Failed to acquire lock for id1")
         }
    })

    it("should release lock", async () => {
        let mockIdList =["id1", "id2"];
        let lockObj = {ids: mockIdList, timeout: "1h"}
        let lockManager = await esmock("../src/locks/lock-manager.js", {
            '../src/locks/lock-api-fetch.js':{ 
                retryFetch: ()=> (mockIdList)
            }
        });

        lockMangerInstance = new lockManager.LockManager("http://foobar:8080")
         
        let resp = await lockMangerInstance.release("test-graph", lockObj);
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
        const waitInterval= await lockMangerInstance.release("test-graph", {ids:mockIdList});
        logger.info(`should not reach here ${waitInterval}`)
        }catch(e){
            assert.equal(e.message,"Failed to release lock for id1,id2")
        }
    })
})