import fetch from "node-fetch"
import { logger } from "../logger.js"
import { Namespace, Schema } from "../model.js"

const KEEP_ALIVE_INTERVAL = 60 // seconds

export class LockManager {
private api = { check: { endpoint: "", options: {} }, acquire: { endpoint: "", options: {} }, keeAlive: { endpoint: "", options: {} }, release: { endpoint: "", options: {} }};

  static create(urlPrefix:string): LockManager {
    return new LockManager(urlPrefix)
  }

  // Handle to the timer
  keepAliveJobHandle: NodeJS.Timeout = null

  constructor(readonly baseUrl: string) {
    logger.info("LockManager.instantiate: Base URL: %s", baseUrl)
    this.api = {
      check:    { endpoint: `${ baseUrl }/`,                options: { method: "GET",  headers: { "Accept": "application/json" }}},
      acquire:  { endpoint: `${ baseUrl }/lock/acquire`,    options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      keeAlive: { endpoint: `${ baseUrl }/lock/keep-alive`, options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      release:  { endpoint: `${ baseUrl }/lock/release`,    options: { method: "POST", headers: { "Content-Type": "application/json" }}},
    }
  }

  async lock(owner: string, lock: Schema.Lock) {
   
    lock.ids = lock.ids.sort()

    let locksAcquired = new Array<string>();

    for (let i = 1; i <= lock.ids.length; i++) {

      const lockId = lock.ids[i-1]
      logger.info("LockManager.lock(): Locking %s of %s: %s", i, lock.ids.length, JSON.stringify({ owner, lockId }))

      try {
        let resp = await fetch(this.api.acquire.endpoint,
        {...this.api.acquire.options, body: JSON.stringify({ owner, lockId, expiryInSec: 120 }) }
        )
        let respJson = await resp.json() as {lockId:string, acquired:boolean};

        if(respJson.acquired){
          locksAcquired.push(lockId)
        }
        //TODO add retry mechanism
        logger.info("LockManager.lockWithId(): %s is locked with resp %s", JSON.stringify({ owner, lockId }), respJson)
      } catch (error) {
        logger.error("failed to call acquire lock for %s with %s", {lockId, owner}, error)
      }
      
    }

    if (locksAcquired && locksAcquired.length > 0) {
      let lock:Schema.Lock = {
        ids: locksAcquired,
        timeout: `${KEEP_ALIVE_INTERVAL}`

      }
      await this.startKeepAliveJob(owner, lock)
    }
  }

  async release(owner: string, lock: Schema.Lock) {
    let {ids} = lock
    try {
      let resp = await fetch(this.api.release.endpoint,
      {...this.api.release.options, body: JSON.stringify(ids) }
      )
      let respJson = await resp.json()

      logger.info("LockManager.release(): Releasing %s resp -->%s", JSON.stringify({ids,owner}), respJson)
    } catch (error) {
      logger.error("LockManager.release(): failed to call release locks %s", {ids}, error)
    }
  }

  private async startKeepAliveJob(owner: string, lock: Schema.Lock) {
    try {
      let resp = await fetch(this.api.keeAlive.endpoint,
      {...this.api.keeAlive.options, body: JSON.stringify({ owner, lockIds: lock.ids, expiryInSec: lock.timeout }) }
      )
      let respJson = await resp.json()
      logger.info("LockManager: Heartbeat for: %s with resp %s", JSON.stringify({ owner, lockIds: lock.ids, expiryInSec: KEEP_ALIVE_INTERVAL }), respJson )
  } catch (error) {
      logger.error("LockManager: failed to keep alive for %s with %s", {lock, owner}, error)
    }

  }
}
