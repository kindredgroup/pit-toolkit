import fetch from "node-fetch"
import { logger } from "../logger.js"
import { Namespace, Schema } from "../model.js"

const KEEP_ALIVE_INTERVAL = 60 // seconds

export class LockManager {
private api = { check: { endpoint: "", options: {} }, acquire: { endpoint: "", options: {} }, keeAlive: { endpoint: "", options: {} }, release: { endpoint: "", options: {} }};

  static create(namespace: Namespace, urlPrefix:string): LockManager {
    return new LockManager(namespace, urlPrefix)
  }

  // Handle to the timer
  keepAliveJobHandle: NodeJS.Timeout = null

  constructor(readonly namespace: Namespace, urlPrefix:string) {
    const baseUrl = `${ urlPrefix }.lock-manager`
    logger.info("LockManager.instantiate: Base URL: %s", baseUrl)
    this.api = {
      check:         { endpoint: `${ baseUrl }/`,          options: { method: "GET", headers: { "Accept": "application/json" }}},
      acquire:        { endpoint: `${ baseUrl }/lock/acquire`,         options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      keeAlive:       { endpoint: `${ baseUrl }/lock/keep-alive`,      options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      release:       { endpoint: `${ baseUrl }/lock/release`,        options: { method: "POST", headers: { "Content-Type": "application/json" }}},
    }
  }

  async lock(owner: string, lock: Schema.Lock) {
   
    if (this.keepAliveJobHandle) {
      throw new Error("lockAll() can only be called once")
    }

    lock.ids = lock.ids.sort()

    

    for (let i = 1; i <= lock.ids.length; i++) {

      const lockId = lock.ids[i-1]
      logger.info("LockManager.lock(): Locking %s of %s: %s", i, lock.ids.length, JSON.stringify({ owner, lockId }))

      try {
        let _resp = await fetch(this.api.acquire.endpoint,
        {...this.api.acquire.options, body: JSON.stringify({ owner, lockId, expiryInSec: 120 }) }
        )
        let _respJson = await _resp.json()

        logger.info("LockManager.lockWithId(): %s is locked with resp %s", JSON.stringify({ owner, lockId }), _respJson)
      } catch (error) {
        logger.error("failed to call acquire lock for %s with %s", {lockId, owner}, error)
      }

      // await this.lockWithId(owner, lockId)

      if (i === 1) {
        // start job only once
        await this.startKeepAliveJob(owner, lock)
      }
    }
  }

  async release(owner: string, lock: Schema.Lock) {
    let {ids} = lock
    try {
      let _resp = await fetch(this.api.release.endpoint,
      {...this.api.release.options, body: JSON.stringify(ids) }
      )
      let _respJson = await _resp.json()

      logger.info("LockManager.release(): Releasing %s resp -->%s", JSON.stringify({ids,owner}), _respJson)
    } catch (error) {
      logger.error("LockManager.release(): failed to call release locks %s", {ids}, error)
    }
  }

  private async startKeepAliveJob(owner: string, lock: Schema.Lock) {
    try {
      let _resp = await fetch(this.api.keeAlive.endpoint,
      {...this.api.keeAlive.options, body: JSON.stringify({ owner, lockIds: lock.ids, expiryInSec: KEEP_ALIVE_INTERVAL }) }
      )
      let _respJson = await _resp.json()
      logger.info("LockManager: Heartbeat for: %s with resp %s", JSON.stringify({ owner, lockIds: lock.ids, expiryInSec: KEEP_ALIVE_INTERVAL }), _respJson )
  } catch (error) {
      logger.error("LockManager: failed to keep alive for %s with %s", {lock, owner}, error)
    }

  }
}
