import { describe, it } from "mocha";
import { RetryOptions, apiFetch, retryFetch } from "../src/locks/lock-api-fetch.js";
import { assert } from "chai";
import esmock from "esmock";
import { logger } from "../src/logger.js";

describe("lock-api-fetch", async () => {
   let esmockedLockFetch = await esmock("../src/locks/lock-api-fetch.js", {
        'node-fetch': {
            default: () => {
                return {
                    json: () => {
                        return { lockId: "id1", acquired: true }
                    }
                }
            }
        }
    })
   let esmockedLockFailFetch = await esmock("../src/locks/lock-api-fetch.js", {
        'node-fetch': {
            default: () => {
                throw new Error("fetch error")
            }
        }
    })


    it("should retry fetch", async () => {
        let api = { endpoint: "http://foobar:8080", options: {} }
        let apiBody = { ids: ["id1", "id2"] }
        let retryOptions: RetryOptions = { retries: 3, retryDelay: 1, api: api }
        let resp = await esmockedLockFetch.retryFetch(retryOptions, apiBody)
        assert.deepEqual(resp, { lockId: "id1", acquired: true })
    })
    it("should retry failed fetch", async () => {
        let baseUrl = "http://localhost:60001"
        let api =  {
            endpoint: `${baseUrl}/locks/acquire`,
            options: {
              method: "POST",
              headers: {"Content-Type": "application/json"},
            },
          }
        let apiBody = { lockId: "id1", owner: "owner1" }
        let retryOptions: RetryOptions = { retries: 3, retryDelay: 1, api: api }
        try{
            let resp = await esmockedLockFailFetch.retryFetch(retryOptions, apiBody)
            // let resp = await retryFetch(retryOptions, apiBody)
        }catch(error){
            logger.info("*****************",error)
            assert.equal(error, `Error: Failed to fetch ${api.endpoint} after ${retryOptions.retries} retries`)
        }
    })
    it("should  fetch", async () => {
        let api = { endpoint: "http://foobar:8080", options: {} }
        let apiBody = { ids: ["id1", "id2"] }
        let retryOptions: RetryOptions = { retries: 3, retryDelay: 1, api: api }
        let resp = await esmockedLockFetch.apiFetch(retryOptions, apiBody)
        assert.deepEqual(resp, { lockId: "id1", acquired: true })
    })

})