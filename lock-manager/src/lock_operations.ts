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
      lock_owner: lock.owner,
      lock_expiry: expirationTime,
      lock_created: new Date(currentTime),
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

   logger.info(result?.rows);
  
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
    console.log("expiryInSec", expiryInSec, `${expiryInSec}`);

    const query = {
      name: "update-key",
      text: `UPDATE manage_locks SET lock_metadata = jsonb_set(lock_metadata, '{lock_expiry}', $1 )
             WHERE lock_id = ANY($2) AND lock_metadata ->> 'lock_owner' = $3 RETURNING *`,
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
   logger.info("release result ", result);
    let unlocked_keys = result?.rows?.map(({lock_id}) => lock_id);
   logger.info("unlocked_keys ", unlocked_keys);
    return unlocked_keys;
  }
}
/* 
class ArrayStorage implements Storage {
    private data: Array<LockManagerResponse> = [];

    async acquire(lock:  LockManagerDTO): Promise<LockManagerResponse> {
        locks.map(lock => {
            // check if key already exists
            if( !!this.data.some(item=>item.lock_id === lock.lock_id)){
                //throw new Error(`Key ${key} already exists`);
                this.data.push({lock_id: lock.lock_id, acquired: false});
            }else{
                this.data.push({lock_id: lock.lock_id, acquired: true});
            }
        });
        return this.data;

    }

    retrieve(key: string): LockManagerResponse | undefined {
        return this.data.find((item=>item.lock_id === key)) 
    }

    async release(keys: Array<String>): Promise<Array<String>> {
        // remove the record if key exists
        keys.map(key => {
            let index = this.data.findIndex(item => item.lock_id === key);
            if( !!index){
                delete this.data[index];
            }
        })
        
        return keys;
    }
}
*/

export default LockFactory;
