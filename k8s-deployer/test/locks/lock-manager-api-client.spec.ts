import esmock from "esmock"

import { describe, it } from "mocha"
import { assert } from "chai"

import { logger } from "../../src/logger.js"
import { RetryOptions } from "../../src/locks/lock-manager-api-client.js"

describe("lock-api-fetch", async () => {
    let mockedLockManagerApi = await esmock("../../src/locks/lock-manager-api-client.js", {
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

    let esmockedLockFailFetch = await esmock("../../src/locks/lock-manager-api-client.js", {
        'node-fetch': {
            default: () => {
                throw new Error("fetch error")
            }
        }
    })

    it("should test retryFetch", async () => {
        let fetchParams = { endpoint: "http://foobar:8080", options: {} }
        let apiBody = { lockId: "id1", owner: "owner1" }
        let retryOptions: RetryOptions = { retries: 3, retryDelay: 1, fetchParams }
        let resp = await mockedLockManagerApi.invoke(retryOptions, apiBody)
        assert.deepEqual(resp, { lockId: "id1", acquired: true })
    })

    it("should retry failed fetch", async () => {
        let baseUrl = "http://localhost:60001"
        let fetchParams =  {
            endpoint: `${baseUrl}/locks/acquire`,
            options: {
              method: "POST",
              headers: {"Content-Type": "application/json"},
            },
          }
        let apiBody = { lockId: "id1", owner: "owner1" }
        let retryOptions: RetryOptions = { retries: 3, retryDelay: 1, fetchParams }
        try {
            let _resp = await mockedLockManagerApi.invoke(retryOptions, apiBody)
        } catch (error) {
            logger.info("*****************",error)
            assert.equal(error, `Error: Failed to fetch ${ fetchParams.endpoint } after ${ retryOptions.retries } retries`)
        }
    })
})