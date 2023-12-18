import { describe, it } from "mocha";
import { RetryOptions } from "../src/locks/lock-api-fetch.js";
import { assert } from "chai";
import esmock from "esmock";

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

    // let mockedFetch = await esmockedLockFetch;

    it("should retry fetch", async () => {
        let api = { endpoint: "http://foobar:8080", options: {} }
        let apiBody = { ids: ["id1", "id2"] }
        let retryOptions: RetryOptions = { retries: 3, retryDelay: 1, api: api }
        let resp = await esmockedLockFetch.retryFetch(retryOptions, apiBody)
        assert.deepEqual(resp, { lockId: "id1", acquired: true })
    })
    it("should  fetch", async () => {
        let api = { endpoint: "http://foobar:8080", options: {} }
        let apiBody = { ids: ["id1", "id2"] }
        let retryOptions: RetryOptions = { retries: 3, retryDelay: 1, api: api }
        let resp = await esmockedLockFetch.apiFetch(retryOptions, apiBody)
        assert.deepEqual(resp, { lockId: "id1", acquired: true })
    })

})