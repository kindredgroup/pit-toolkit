import { logger } from "../logger.js"
import { Namespace, Schema } from "../model.js"

const KEEP_ALIVE_INTERVAL = 10_000 // millis

export class LockManager {
  static create(namespace: Namespace): LockManager {
    return new LockManager(namespace)
  }

  // Handle to the timer
  keepAliveJobHandle: NodeJS.Timeout = null

  constructor(readonly namespace: Namespace) {}

  async lock(owner: string, lock: Schema.Lock) {
    if (this.keepAliveJobHandle) {
      throw new Error("lockAll() can only be called once")
    }

    lock.ids = lock.ids.sort()

    for (let i = 1; i <= lock.ids.length; i++) {
      const lockId = lock.ids[i-1]
      logger.info("MockLockManager.lock(): Locking %s of %s: %s", i, lock.ids.length, JSON.stringify({ owner, lockId }))

      await this.lockWithId(owner, lockId)

      if (i === 1) {
        // start job only once
        this.startKeepAliveJob(owner, lock)
      }
    }
  }

  async release(owner: string, lock: Schema.Lock) {
    if (this.keepAliveJobHandle) {
      clearInterval(this.keepAliveJobHandle)
    }
    logger.info("MockLockManager.release(): Releasing %s", JSON.stringify({ owner, lock }))
  }

  private startKeepAliveJob(owner: string, lock: Schema.Lock) {
    this.keepAliveJobHandle = setInterval(() => {
      logger.info("MockLockManager: Heartbeat for: %s", JSON.stringify({ owner, lock }))
    }, KEEP_ALIVE_INTERVAL)
  }

  private async lockWithId(owner: string, lockId: string) {
    logger.info("MockLockManager.lockWithId(): %s is locked.", JSON.stringify({ owner, lockId }))
  }
}
