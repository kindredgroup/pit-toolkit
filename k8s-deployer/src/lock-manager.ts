import { logger } from "./logger.js"
import { Namespace, Schema } from "./model.js"

export class LockManager {
  static create(namespace: Namespace): LockManager {
    return new LockManager(namespace)
  }

  constructor(readonly namespace: Namespace) {}

  lock = async (owner: string, lock: Schema.Lock) => {
    logger.info("MockLockManager.lock(): Locking '%s'", JSON.stringify({ owner, lock }))
  }

  release = async (owner: string, lock: Schema.Lock) => {
    logger.info("MockLockManager.release(): Releasing '%s'", JSON.stringify({ owner, lock }))
  }
}
