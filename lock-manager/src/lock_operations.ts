import {
  Db,
  LockKeepAlive,
  LockAcquireObject,
  LockManagerResponse,
  LockMetadata,
} from "./db/db.js";
import { getParam } from "./configuration.js";
import { logger } from "./logger.js";


export interface Storage {
  acquire(lock: LockAcquireObject, db: Db): Promise<LockManagerResponse>;
  keepAlive(locks: LockKeepAlive, db: Db): Promise<Array<String>>;
  release(lockIds: Array<String>, db: Db): Promise<Array<String>>;
}

class LockFactory {
  static instantiate(): Storage {
    return new DatabaseStorage()
  }
}

class DatabaseStorage implements Storage {
  async acquire(lock: LockAcquireObject, db: Db): Promise<LockManagerResponse> {
    let {expiryInSec = 60} = lock;
    const currentTime = Date.now();
    const expirationTime = new Date(currentTime + expiryInSec * 1000); // Add seconds to current time
   logger.info("values", currentTime, expiryInSec, expirationTime);
    let lockMetadata: LockMetadata = {
      lockOwner: lock.owner,
      lockExpiry: expirationTime,
      lockCreated: new Date(currentTime),
    };

    let query = {
      name: "insert-lock",
      text: `INSERT INTO manage_locks (lock_id, lock_metadata) VALUES ($1, $2) 
            RETURNING lock_id`,
      values: [lock.lockId, JSON.stringify(lockMetadata)],
    };

    const result = await db.execute(query);
    if (result?.name === "error") {
      // TODO handle error
      console.error("Error from lock::",result?.message);
      throw new Error(result?.message);
    }

   logger.debug(result?.rows);
  
    let {lock_id} = result?.rows[0];

    let acquired = !!lock_id;
    return {lockId: lock_id, acquired};
  }
  async keepAlive(leaseIncrObj: LockKeepAlive, db: Db): Promise<Array<String>> {
    let expiryInSec_conf = getParam('RENEW_BY_IN_SEC', 60) as number;
    let {
      lockIds,
      owner,
      expiryInSec = new Date(Date.now() + expiryInSec_conf * 1000).toISOString(),
    } = leaseIncrObj;
    // convert expiryInSec into string without changing the date type
    logger.debug("expiryInSec", expiryInSec, `${expiryInSec}`);

    const query = {
      name: "update-key",
      text: `UPDATE manage_locks SET lock_metadata = jsonb_set(lock_metadata, '{lock_expiry}', $1 )
             WHERE lock_id = ANY($2) AND lock_metadata ->> 'lockOwner' = $3 RETURNING *`,
      values: [`"${expiryInSec}"`, lockIds, owner],
    };

    const result = await db.execute(query);
    if (result?.name === "error") {
      throw new Error(result?.message);
    }
   logger.info("update result ", result);
    if (result?.rows.length === 0) {
      throw new Error("No valid lock and owner combination found");
    }else{
      
      let lock_ids = result?.rows?.map(({lock_id}) => lock_id);
      return lock_ids;
    }
  }

  async release(keys: Array<String>, db: Db): Promise<Array<String>> {
    const query = {
      name: "delete-key",
      text: `DELETE FROM manage_locks WHERE lock_id = ANY ($1) AND
        EXISTS (SELECT lock_id FROM manage_locks WHERE lock_id = ANY ($1) ) RETURNING lock_id`,
      values: [keys],
    };

    const result = await db.execute(query);
    if (result?.name === "error") {
      throw new Error(result?.message);
    }
   logger.debug("release result ", result);
    let unlocked_keys = result?.rows?.map(({lock_id}) => lock_id);
   logger.debug("unlocked_keys ", unlocked_keys);
    return unlocked_keys;
  }
}

export default LockFactory;
