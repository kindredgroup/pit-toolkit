import * as chai from "chai"
import * as sinon from "sinon"
import esmock from "esmock"
import { describe, it } from "mocha"
import { logger } from "../../src/logger.js"

describe("LockManager", () => {

  it("should acquire and release lock", async () => {
    const lockId = "id1"
    const LockManagerModule = await esmock("../../src/locks/lock-manager.js", {
      '../../src/locks/http-client.js': {
        invoke: ()=> ({ lockId, acquired: true })
      }
    })

    const lockManger = new LockManagerModule.LockManager("test-owner", "http://foobar:8080")
    const lock = { ids: [ lockId ] }
    const resp = await lockManger.lock(lock)
    await lockManger.release(lock)
    chai.expect(resp).deep.eq(lock.ids)
  })

  it("should keep trying to lock while resource is not available", async () => {
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Setup API responses simulating for scenario where at first the resource
    // is locked by someone else and then becomes available
    const apiClientStub = { invoke: sinon.stub() }

    apiClientStub.invoke
      .withArgs(sinon.match.any, sinon.match.any)
      .onCall(0).returns({ acquired: false })
      .onCall(1).returns({ acquired: false })
      .onCall(2).returns({ acquired: true, lockExpiry: new Date(), lockId: 'id1' })
      .onCall(3).returns({ lockIds: [ 'id1' ] })

    const LockManagerModule = await esmock("../../src/locks/lock-manager.js", {
      "../../src/locks/http-client.js": apiClientStub
    })

    const lockManger = new LockManagerModule.LockManager("test-owner", "http://foobar:8080")
    const lock = { ids: [ "id1" ], timeout: "1h" }
    const response = await lockManger.lock(lock)
    chai.expect(response).deep.eq([ 'id1' ])
    chai.expect(apiClientStub.invoke.callCount).eq(3)
    await lockManger.release(lock)
  })

  it("should test invalid timeout", async () => {
    const LockManagerModule = await esmock("../../src/locks/lock-manager.js")
    const lockManger = new LockManagerModule.LockManager("test-owner", "http://foobar:8080")
    const timeout = 0
    try {
        await lockManger.lock({ ids: [ "id1" ], timeout })
    } catch (e) {
      chai.expect(e.message).eq(`Timeout ${ timeout } should be a string eg 1h, 1m or 1s`)
    }
  })

  it("should throw error if lock is not acquired", async () => {
    const LockManagerModule = await esmock("../../src/locks/lock-manager.js", {
      "../../src/locks/http-client.js": {
        invoke: ()=>  { throw new Error("Failed to acquire lock") }
      }
    })

    const lockManger = new LockManagerModule.LockManager("test-owner", "http://foobar:8080")

    try {
      await lockManger.lock({ ids: [ "id1", "id2" ] })
    } catch (e) {
      chai.expect(e.message).eq("Failed to acquire lock for id1")
    }
  })

  it("should release lock", async () => {
    const mockIdList = [ "id1", "id2" ]
    const lock = { ids: mockIdList, timeout: "1h" }
    const LockManagerModule = await esmock("../../src/locks/lock-manager.js", {
      '../../src/locks/http-client.js': {
        invoke: ()=> (mockIdList)
      }
    })

    const lockMangerInstance = new LockManagerModule.LockManager("test-owner", "http://foobar:8080")
    const resp = await lockMangerInstance.release(lock)
    chai.expect(resp).deep.eq(mockIdList)
  })

  it("should throw error if lock is not released", async () => {
    const mockIdList = [ "id1", "id2" ]
    const LockManagerModule = await esmock("../../src/locks/lock-manager.js", {
      '../../src/locks/http-client.js': {
        invoke: ()=>  { throw new Error("Failed to release lock") }
      }
    })

    const lockManger = new LockManagerModule.LockManager("test-owner", "http://foobar:8080")

    try {
      const waitInterval= await lockManger.release({ ids: mockIdList })
      logger.info(`should not reach here ${ waitInterval }`)
    } catch(e) {
      chai.expect(e.message).eq("Failed to release lock for id1,id2")
    }
  })
})