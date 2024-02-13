import esmock from "esmock"
import * as chai from "chai"
import chaiAsPromised from 'chai-as-promised'

import * as sinon from "sinon"

import { describe, it } from "mocha"

import { RetryOptions } from "../../src/locks/http-client.js"

chai.use(chaiAsPromised)

describe("lock-api-fetch", async () => {
  const createHttpErrorWithJson = (status: number, text: string, body: unknown): unknown => {
    return {
      ok: false,
      status: status,
      statusText: text,
      headers: new Map([ [ "content-type", "application/json" ] ]),
      json: () => { return body }
    }
  }

  const createJsonResponseTemplate = (response: unknown): unknown => {
    return {
      ok: true,
      headers: new Map([ [ "content-type", "application/json" ] ]),
      json: () => { return response }
    }
  }

  const mockHttpCall = async (stubFunction: any): Promise<any> => {
    return await esmock(
      "../../src/locks/http-client.js",
      {
        'node-fetch': {
          default: () => { return stubFunction() }
        }
      }
    )
  }

  const mockResponse = async (response: unknown): Promise<any> => {
    return mockHttpCall(sinon.stub().returns(response))
  }

  const mockJsonResponse = async (response: unknown): Promise<any> => {
    return await mockResponse(createJsonResponseTemplate(response))
  }

  it("invoke() should return parsed JSON response", async () => {
    const fetchParams = { endpoint: "http://foobar:8080", options: {} }
    const apiBody = { lockId: "id1", owner: "owner1" }
    const retryOptions: RetryOptions = { retries: 3, retryDelay: 1, fetchParams }
    const expectedResponse = { lockId: "id1", acquired: true }
    const $resp = (await mockJsonResponse(expectedResponse)).invoke(retryOptions, apiBody)
    chai.expect(await $resp).deep.eq(expectedResponse)
  })

  it("invoke() should retry failing HTTP call", async () => {
    const fetchParams = { endpoint: "http://foobar:8080/fail", options: {} }
    const expectedResponse = { lockId: "id1", acquired: true }
    const invokeStub = sinon.stub()
    const errorResp = createHttpErrorWithJson(500, "Internal server error", { error: "Some serverside error" })
    invokeStub.onFirstCall().returns(errorResp)
    invokeStub.onSecondCall().returns(errorResp)
    invokeStub.onThirdCall().returns(createJsonResponseTemplate(expectedResponse))

    const retryOptions: RetryOptions = { retries: 3, retryDelay: 1, fetchParams }
    const $resp = (await mockHttpCall(invokeStub)).invoke(retryOptions, { some: "input-payload" })
    chai.expect(await $resp).deep.eq(expectedResponse)
    chai.expect(invokeStub.callCount).eq(3)
  })

  it("invoke() should giveup failing HTTP call", async () => {
    const fetchParams = { endpoint: "http://foobar:8080/fail", options: {} }
    const invokeStub = sinon.stub()
    const errorResp = createHttpErrorWithJson(500, "Internal server error", { error: "Some serverside error" })
    invokeStub.onFirstCall().returns(errorResp)
    invokeStub.onSecondCall().returns(errorResp)
    invokeStub.onThirdCall().returns(errorResp)
    const retryOptions: RetryOptions = { retries: 3, retryDelay: 1, fetchParams }
    const $resp = (await mockHttpCall(invokeStub)).invoke(retryOptions, { some: "input-payload" })

    let wasError: boolean = false
    try {
      await $resp
    } catch (error) {
      wasError = true
      chai.expect(error.cause).not.undefined
      chai.expect(error.cause).property("type", "HttpError")
      chai.expect(error.cause).property("status", 500)
      chai.expect(error.cause).property("text", "Internal server error")
      chai.expect(error.cause.responseData).deep.eq({ error: 'Some serverside error' })
    }
    if (!wasError) chai.expect.fail("invoke() is epexcted to thorw an error")
    chai.expect(invokeStub.callCount).eq(3)
  })

})