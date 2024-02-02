import {logger} from "../logger.js"
import {Schema} from "../model.js"
import * as LockManagerApi from "./lock-manager-api-client.js"

const KEEP_ALIVE_INTERVAL = 10 // seconds
const RETRY_TIMEOUT = 1000 // milliseconds
export class LockManager {
  static create(lockOwner: string, urlPrefix: string, apiRetries: number): LockManager {
    return new LockManager(lockOwner, urlPrefix, apiRetries)
  }

  private api = {
    check: { endpoint: "", options: {} },
    acquire: { endpoint: "", options: {} },
    keepAlive: { endpoint: "", options: {} },
    release: { endpoint: "", options: {} },
  }

  // Handle to the timer
  keepAliveJobHandle: NodeJS.Timeout = null

  constructor(readonly lockOwner: string, readonly urlPrefix: string, private readonly apiRetries: number) {
    const baseUrl = `${urlPrefix}`;
    logger.info("LockManager.instantiate: Base URL: %s", baseUrl)
    this.api = {
      check:     { endpoint: `${ baseUrl }/`,                 options: { method: "GET",  headers: { "Accept": "application/json" }}},
      acquire:   { endpoint: `${ baseUrl }/locks/acquire`,    options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      keepAlive: { endpoint: `${ baseUrl }/locks/keep-alive`, options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      release:   { endpoint: `${ baseUrl }/locks/release`,    options: { method: "POST", headers: { "Content-Type": "application/json" }}},
    }
  }

  private cleanupIds(ids: Array<string>): Array<string> {
    const uniqueSet = new Array<string>()
    for (let i of ids) {
      const v = i.trim()
      if (uniqueSet.indexOf(i) == -1) uniqueSet.push(v)
    }
    return uniqueSet.sort()
  }

  // Check if the lock is available for the owner using fetch.
  async lock(lock: Schema.Lock): Promise<string[]> {
    this.validateArgs(this.lockOwner, lock)
    lock.ids = this.cleanupIds(lock.ids)

    let locksAcquired = new Array<string>()

    let retryOptions: LockManagerApi.RetryOptions = {
      retries: this.apiRetries,
      retryDelay: RETRY_TIMEOUT,
      fetchParams: this.api.acquire,
    }

    for (let i = 1; i <= lock.ids.length; i++) {
      const lockId = lock.ids[i - 1]
      logger.info("LockManager.lock(): Locking %s of %s: %s",
        i, lock.ids.length, JSON.stringify({ owner: this.lockOwner, lockId })
      )

      while (locksAcquired.indexOf(lockId) == -1) {
        try {
          let response = await LockManagerApi.invoke(retryOptions, { owner: this.lockOwner, lockId }) as any
          logger.info("LockManager.lock(): %s of %s. Outcome: %s", i, lock.ids.length, JSON.stringify({ request: { owner: this.lockOwner, lockId }, response }))
          if (response.acquired) {
            locksAcquired.push(response.lockId)
            if (!this.keepAliveJobHandle) {
              // start job only once
              await this.startKeepAliveJob(this.lockOwner, lock, new Date(Date.parse(response.lockExpiry)))
            }
            break
          } else {
            const sleep = new Promise(resolve => setTimeout(resolve, 2_000))
            await sleep
          }
        } catch (error) {
          logger.error("LockManager.lock(): Failed to acquire lock for %s", lockId)
          logger.error(error)
          if (locksAcquired.length > 0) {
            // release the locks acquired so far
            await this.release({ ids: locksAcquired, timeout: lock.timeout })
          }
          throw new Error(`Failed to acquire lock for ${ lockId }`, { cause: error })
        }
      }
    }
    logger.info("LockManager.lock(): Lock owner %s requested locks %s and acquired the following locks %s", this.lockOwner, lock.ids, locksAcquired)
    return locksAcquired
  }

  // Release the lock for the owner using fetch.
  async release(lock: Schema.Lock) {
    this.validateArgs(this.lockOwner, lock)
    lock.ids = this.cleanupIds(lock.ids)

    let retryOptions: LockManagerApi.RetryOptions = {
      retries: this.apiRetries,
      retryDelay: RETRY_TIMEOUT,
      fetchParams: this.api.release,
    }

    if (this.keepAliveJobHandle) {
      clearInterval(this.keepAliveJobHandle)
    }

    logger.info("LockManager.release(): Releasing lock for %s", lock.ids)
    try {
      let respJson = await LockManagerApi.invoke(retryOptions, { owner: this.lockOwner, lockIds: lock.ids })
      logger.info("LockManager.release(): %s is released for %s", lock.ids, this.lockOwner)
      return respJson
    } catch (error) {
      logger.error("LockManager.release(): Failed to release lock for %s", lock.ids, error)
      throw new Error(`Failed to release lock for ${ lock.ids }`, { cause: error })
    }
  }

  private async keepAliveFetch(lock: Schema.Lock) {
    logger.debug("keepAliveFetch(): %s", JSON.stringify({ owner: this.lockOwner, lock }))
    this.validateArgs(this.lockOwner, lock)
    lock.ids = this.cleanupIds(lock.ids)

    // lock-manager expects expiryInSec as seconds
    // but k8s-deployer passes it as string 1h or 1m
    // convert it to seconds
    let expiryInSec = 0
    let timeUnit = lock.timeout.trim().slice(-1)
    let timeValue = parseInt(lock.timeout.slice(0, -1))
    if (timeUnit === "h") {
      expiryInSec = timeValue * 60 * 60
    } else if (timeUnit === "m") {
      expiryInSec = timeValue * 60
    } else if (timeUnit === "s") {
      expiryInSec = timeValue
    }

    let retryOptions: LockManagerApi.RetryOptions = {
      retries: this.apiRetries,
      retryDelay: RETRY_TIMEOUT,
      fetchParams: this.api.keepAlive,
    }
    try {
      let params = { owner: this.lockOwner, lockIds: lock.ids, expiryInSec }
      let resp = (await LockManagerApi.invoke(retryOptions, params)) as any
      logger.debug("LockManager.keepAliveFetch(): keepAlive api for: %s with resp %s", JSON.stringify(params), resp)
      return resp
    } catch (error) {
      logger.error("LockManager.keepAliveFetch(): failed to keep alive for %s with %s", { lock, owner: this.lockOwner }, error)
      throw new Error(`Failed to keep alive for ${ lock.ids }`, { cause: error })
    }
  }

  private async startKeepAliveJob(owner: string, lock: Schema.Lock, lockExpiry: Date) {

    const now = new Date()
    const networkAllowanceMillis = 2000 // minus 2 seconds for network roundtrip
    const minLockLifeSpan = lockExpiry.getTime() - now.getTime() - networkAllowanceMillis
    let heartbeatFrequency = KEEP_ALIVE_INTERVAL * 1000
    if (minLockLifeSpan <= 0) {
      logger.warn("LockManager.startKeepAliveJob(): Lock lifespan is too short. Will use default hearbeat frequency. %s", JSON.stringify(
        { heartbeatFrequency, lockInfo: { owner, lock, lockExpiry }, timing: { now, networkAllowanceMillis, computedMinLockLifeSpan: minLockLifeSpan } }
      ))
    } else {
      heartbeatFrequency = Math.min(minLockLifeSpan, heartbeatFrequency)
    }

    this.keepAliveJobHandle = setInterval(async () => {
      try {
          logger.info("LockManager. Heartbeat for: %s", JSON.stringify({ owner, lock }))
          return await this.keepAliveFetch(lock)
      } catch (error) {
        clearInterval(this.keepAliveJobHandle)
        logger.error("LockManager. Heartbeat failed for %s with %s", JSON.stringify({ lock, owner }), error)
        await this.release(lock)
      }
    }, heartbeatFrequency)
  }

  private validateArgs(owner: string, lock: Schema.Lock) {
    logger.debug("LockManager.validateArgs(): %s", JSON.stringify({ owner, lock }))
    if (!owner || owner.trim().length === 0) {
      throw new Error("Owner is not provided")
    }

    if (!lock.ids || lock.ids.length === 0) {
      throw new Error("Lock ids are not provided")
    }

    if (lock.timeout === undefined || lock.timeout === null) return

    const msg = `Timeout ${ lock.timeout } should be a string eg 1h, 1m or 1s`
    if (typeof(lock.timeout) !== "string") throw new Error(msg)

    let timeUnit = lock.timeout.trim().slice(-1)
    if (![ "h", "m", "s" ].includes(timeUnit)) throw new Error(msg)

    let timeValue = parseInt(lock.timeout.slice(0, -1), 10)
    if (isNaN(timeValue) || timeValue < 0) throw new Error(msg)
  }
}
