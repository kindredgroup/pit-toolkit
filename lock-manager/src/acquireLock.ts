import { Db, LockManagerDTO, LockManagerResponse } from "./db/db.js";

type LockObject = {
  key: string;
  owner: string;
  expiration: Date;
}

export interface Storage {
    acquire(locks: Array<LockManagerDTO>, db: Db): Promise<Array<LockManagerResponse>>;
    release(keys: Array<String>, db: Db): Promise<Array<String>>;
}

class LockFactory {
    static instantiate(type: 'db' | 'array'): Storage {
        switch (type) {
            case 'db':
                return new DatabaseStorage();
            case 'array':
                return new ArrayStorage();
            default:
                throw new Error(`Invalid storage type: ${type}`);
        }
    }
}


class DatabaseStorage implements Storage {
    
    async acquire(locks: Array<LockManagerDTO>, db:Db): Promise<Array<LockManagerResponse>> {
        const values = locks.map(lock => {
            const currentTime = Date.now();
            const expirationTime = new Date(currentTime + lock.expiryInSec * 1000); // Add seconds to current time
            console.info('time', currentTime, lock.expiryInSec, expirationTime);
            return [lock.lockKey, new Date(), expirationTime, lock.owner];
        });

        let query = {
            name: 'insert-key',
            text: `INSERT INTO keys_table (lock_key, created, expiration, owner) VALUES %L 
            ON CONFLICT (lock_key) 
            DO UPDATE SET 
            created = EXCLUDED.created, 
            expiration = EXCLUDED.expiration,
            owner = EXCLUDED.owner
            WHERE keys_table.expiration < now()
            RETURNING *`,
            values: values
        };
        const result = await db.format_nd_execute(query);
        if(result?.name === 'error'){
            // TODO handle error
            throw new Error(result?.message);
        }

        console.info(result?.rows);
        let locked_keys = locks.map(({lockKey})=>{
            let acquired = result?.rows?.some((item: LockObject) => item.key === lockKey);
            return { lockKey, acquired };
        });
        return locked_keys;
    }

     async release(keys: Array<String>,db:Db): Promise<Array<String>> {
        const query = {
            name: 'delete-key',
            text:'DELETE FROM keys_table WHERE lock_key IN %L RETURNING key',
            values: [keys]
        };

        const result = await db.format_nd_execute(query);
        if(result?.name === 'error'){
            throw new Error(result?.message);
        }
        console.info('release result ',result);
        let unlocked_keys = result?.rows?.map(({key}: LockObject) =>key)
        return unlocked_keys;
        
    }
}

class ArrayStorage implements Storage {
    private data: Array<LockManagerResponse> = [];

    async acquire(locks: Array<LockManagerDTO>): Promise<Array<LockManagerResponse>> {
        locks.map(lock => {
            // check if key already exists
            if( !!this.data.some(item=>item.lockKey === lock.lockKey)){
                //throw new Error(`Key ${key} already exists`);
                this.data.push({lockKey: lock.lockKey, acquired: false});
            }else{
                this.data.push({lockKey: lock.lockKey, acquired: true});
            }
        });
        return this.data;

    }

    retrieve(key: string): LockManagerResponse | undefined {
        return this.data.find((item=>item.lockKey === key)) 
    }

    async release(keys: Array<String>): Promise<Array<String>> {
        // remove the record if key exists
        keys.map(key => {
            let index = this.data.findIndex(item => item.lockKey === key);
            if( !!index){
                delete this.data[index];
            }
        })
        
        return keys;
    }
}

export default LockFactory;