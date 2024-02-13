import {
  Db,
  LockKeepAlive,
  LockAcquireObject,
  LockManagerResponse,
  LockMetadata,
  ReleaseLocks,
} from "./db/db.js"
import { getConfigParam } from "./configuration.js"
import {logger} from "./logger.js"

export interface Storage {
  acquire(lock: LockAcquireObject, db: Db): Promise<LockManagerResponse>
  keepAlive(locks: LockKeepAlive, db: Db): Promise<Array<string>>
  release(releaseLocks: ReleaseLocks, db: Db): Promise<Array<string>>
}

class LockFactory {
  static instantiate(): Storage {
    return new DatabaseStorage()
  }
}

class DatabaseStorage implements Storage {
  readonly renewByInSec: number
  constructor() {
    this.renewByInSec = getConfigParam("RENEW_BY_IN_SEC", 60) as number
  }

  async acquire(lock: LockAcquireObject, db: Db): Promise<LockManagerResponse> {
    const { expiryInSec = 10 } = lock
    const currentTime = Date.now()
    const expirationTime = new Date(currentTime + expiryInSec * 1000)
    logger.info("acquire(): acquire lock with args lock %s currentTime %s expiryInSec %s expirationTime %s", lock, new Date(currentTime), expiryInSec, expirationTime)
    const lockMetadata: LockMetadata = {
      lockOwner: lock.owner,
      lockExpiry: expirationTime,
      lockCreated: new Date(currentTime),
    }

    const query = {
      name: "insert-lock",
      text: `INSERT INTO locks (lock_id, lock_metadata) VALUES ($1, $2)
            ON CONFLICT (lock_id) DO UPDATE SET lock_metadata = $2 WHERE locks.lock_id = $1 AND (locks.lock_metadata->>'lockExpiry')::timestamp with time zone < ($3)::timestamp with time zone
            RETURNING lock_id`,
      values: [ lock.lockId, JSON.stringify(lockMetadata), new Date(currentTime) ],
    }

    const result = await db.execute(query)
    if (result?.rows.length > 0) {
      const lock_id = result?.rows[0].lock_id
      const acquired = !!lock_id
      return { lockId: lock_id, acquired, lockExpiry: expirationTime }
    } else {
      return { lockId: lock.lockId, acquired: false }
    }
  }

  async keepAlive(keepAlive: LockKeepAlive, db: Db): Promise<Array<string>> {
    logger.debug("keepAlive lock %s", keepAlive)
    let expiryAt = new Date(Date.now() + this.renewByInSec * 1000).toISOString()

    const query = {
      name: "update-key",
      text: `UPDATE locks SET lock_metadata = jsonb_set(lock_metadata, '{lockExpiry}', $1)
             WHERE lock_id = ANY($2) AND lock_metadata->>'lockOwner' = $3 RETURNING *`,
      values: [ `"${ expiryAt }"`, keepAlive.lockIds, keepAlive.owner ],
    }

    const result = await db.execute(query)

    if (result?.rows.length === 0) {
      throw new Error("No valid lock and owner combination found")
    } else {
      let lockIds = result?.rows?.map(({ lock_id }) => lock_id)
      return lockIds
    }
  }

  async release(releaseReq: ReleaseLocks, db: Db): Promise<Array<string>> {
    logger.debug("release keys: %s", JSON.stringify(releaseReq))
    const query = {
      name: "delete-key",
      text: `DELETE FROM locks WHERE lock_id = ANY ($1) AND
        EXISTS (SELECT lock_id FROM locks WHERE lock_id = ANY ($1) ) AND lock_metadata ->> 'lockOwner' = $2 RETURNING lock_id`,
      values: [ releaseReq.lockIds, releaseReq.owner ],
    }

    const result = await db.execute(query)

    let unlockedKeys = result?.rows?.map(({ lock_id }) => lock_id)
    if (unlockedKeys?.length === 0) {
      throw new Error("No valid lock and owner combination found in database to delete")
    }
    logger.debug("release lock ids %s ", unlockedKeys)
    return unlockedKeys
  }
}

export default LockFactory
