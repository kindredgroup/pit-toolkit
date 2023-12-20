import {logger} from "../logger.js"
import {Schema} from "../model.js"
import {RetryOptions, retryFetch} from "./lock-api-fetch.js"

const KEEP_ALIVE_INTERVAL = 1000 // seconds
const RETRY_COUNT = 3
const RETRY_TIMEOUT = 1000 // milliseconds
export class LockManager {
  private readonly apiRetries: number
  private api = {
    check: {endpoint: "", options: {}},
    acquire: {endpoint: "", options: {}},
    keepAlive: {endpoint: "", options: {}},
    release: {endpoint: "", options: {}},
  }

  static create(urlPrefix: string, apiRetries: number): LockManager {
    return new LockManager(urlPrefix,apiRetries)
  }

  // Handle to the timer
  keepAliveJobHandle: NodeJS.Timeout = null

  constructor(readonly urlPrefix: string, apiRetries: number) {
    const baseUrl = `${urlPrefix}`;
    this.apiRetries = apiRetries;
    logger.info("LockManager.instantiate: Base URL: %s", baseUrl)
    this.api = {
      check:    { endpoint: `${ baseUrl }/`,                options: { method: "GET",  headers: { "Accept": "application/json" }}},
      acquire:  { endpoint: `${ baseUrl }/lock/acquire`,    options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      keepAlive: { endpoint: `${ baseUrl }/lock/keep-alive`, options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      release:  { endpoint: `${ baseUrl }/lock/release`,    options: { method: "POST", headers: { "Content-Type": "application/json" }}},
    }
  }
 

  // Check if the lock is available for the owner using fetch
  // in case of fetch error the method retries for RETRY_COUNT times
  //
  async lock(owner: string, lock: Schema.Lock) {
    this.validateArgs(owner, lock)
    lock.ids = lock.ids.sort()

    let locksAcquired = new Array<string>()

    let retryOptions: RetryOptions = {
      retries: this.apiRetries,
      retryDelay: RETRY_TIMEOUT,
      api: this.api.acquire,
    }
    for (let i = 1; i <= lock.ids.length; i++) {
      const lockId = lock.ids[i - 1]
      logger.info("LockManager.lock(): Locking %s of %s: %s",
        i, lock.ids.length, JSON.stringify({owner, lockId})
      )

      try {
        let respJson = await retryFetch(retryOptions, {
          owner,
          lockId,
        })as any
        if (respJson.acquired) {
          locksAcquired.push(respJson.lockId)
        }
        if (i === 1) {
          // start job only once
          await this.startKeepAliveJob(owner, lock)
        }
      } catch (error) {logger.error("LockManager.lock(): Failed to acquire lock for %s",
          lock.ids[0],error)
          if(locksAcquired.length > 0){
            // release the locks acquired so far
            await this.release(owner, {ids: locksAcquired, timeout: lock.timeout})
          }
        throw new Error(`Failed to acquire lock for ${lockId}`)
      }
     
    }
    logger.info("LockManager.lock(): %s is acquire success for owner",
      lock.ids, owner)
    return locksAcquired
  }

  // Release the lock for the owner using fetch
  // in case of fetch error the method retries for RETRY_COUNT times
  async release(owner: string, lock: Schema.Lock) {
    this.validateArgs(owner, lock)
    let {ids} = lock
    let respJson
    let retryOptions: RetryOptions = {
      retries: this.apiRetries,
      retryDelay: RETRY_TIMEOUT,
      api: this.api.release,
    }

    if (this.keepAliveJobHandle) {
      clearInterval(this.keepAliveJobHandle)
    }

    logger.info("LockManager.release(): Releasing lock for %s", lock.ids)
    try {
      respJson = await retryFetch(retryOptions, {
        owner,
        lockIds: ids,
      })
    } catch (error) {
      logger.error( "LockManager.release(): Failed to release lock for %s",
        lock.ids, error)
      throw new Error(`Failed to release lock for ${lock.ids}`)
    }
    logger.info("LockManager.release(): %s is released for %s",
      lock.ids, owner)
    return respJson
  }

  private async keepAliveFetch(owner: string, lock: Schema.Lock) {
    const {ids:lockIds, timeout} = lock
    logger.info("keepAliveFetch(): %s", JSON.stringify({owner, lockIds, timeout}))
    this.validateArgs(owner, lock)
    // lock-manager expects expiryInSec as seconds
    // but k8s-deployer passes it as string 1h or 1m
    // convert it to seconds
    let expiryInSec = 0
    let timeUnit = timeout.trim().slice(-1)
    let timeValue = parseInt(timeout.slice(0, -1))
    if (timeUnit === "h") {
      expiryInSec = timeValue * 60 * 60
    } else if (timeUnit === "m") {
      expiryInSec = timeValue * 60
    } else if (timeUnit === "s") {
      expiryInSec = timeValue
    }
    let retryOptions: RetryOptions = {
      retries: this.apiRetries,
      retryDelay: RETRY_TIMEOUT,
      api: this.api.keepAlive,
    }
    try {
      let resp = (await retryFetch(retryOptions, {
        owner,
        lockIds,
        expiryInSec,
      })) as any
      logger.info( "LockManager.keepAliveFetch(): keepAlive api for: %s with resp %s", 
        JSON.stringify({owner,lockIds, expiryInSec: timeout, }),resp)
      return resp
    } catch (error) {
      logger.error("LockManager.keepAliveFetch(): failed to keep alive for %s with %s",
        {lockIds, owner},error )
      throw new Error(`Failed to keep alive for ${lockIds}`)
    }
  }

  private async startKeepAliveJob(owner: string, locks: Schema.Lock) {
    logger.info("LockManager.startKeepAliveJob(): Heartbeat for: %s", JSON.stringify({owner,locks}))
    this.keepAliveJobHandle = setInterval(async () => {
    try{
        return await  this.keepAliveFetch(owner, locks)
      }catch(error){
        clearInterval(this.keepAliveJobHandle)
        logger.error("LockManager.startKeepAliveJob(): failed to keep alive for %s with %s", {locks, owner}, error)
        await this.release(owner, locks)
        
        throw new Error(`LockManager.startKeepAliveJob(): ${error}`)
      }
      }, KEEP_ALIVE_INTERVAL)
   

  }

  private validateArgs(owner: string, lock: Schema.Lock) {
    let {timeout} = lock
    logger.info("LockManager.validateArgs(): %s", JSON.stringify({owner, lock}))
    if (!owner) {
      throw new Error("LockManager.validateParams(): owner is not provided")
    }
    if (!lock.ids || lock.ids.length === 0) {
      throw new Error("LockManager.validateParams(): lock ids are not provided")
    }
   
    if(timeout === undefined || timeout === null){}else{
    let isTimeoutValid = true
    if (typeof timeout === "string") {
      let timeUnit = timeout.trim().slice(-1)
      let timeValue = parseInt(timeout.slice(0, -1))
      if(isNaN(timeValue)|| timeValue < 0){
        isTimeoutValid = false
      }
      if(!["h","m","s"].includes(timeUnit)){
        isTimeoutValid = false
      }
    } else {
      isTimeoutValid = false
    }
    if(!isTimeoutValid){
      logger.info("LockManager.validateParams(): is timeout valid %s ", isTimeoutValid.toString())
      throw new Error(`LockManager.validateParams(): timeout ${timeout} should be a string eg 1h, 1m or 1s`)
    }
  }
  }
   
}
