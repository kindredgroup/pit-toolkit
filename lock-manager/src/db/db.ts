
export interface DbConfig {
    user: string;
    host: string;
    database: string;
    password: string;
    port: number;
} 

export interface DbPoolConfig { 
    max: number;
    min: number;
    connectionTimeoutMillis: number;
    idleTimeoutMillis: number;
}

export interface DbPool {
    // connect(): Promise<Db>;
    // connect() : Promise<Db>;
    disconnect(): Promise<void>;
}
  

export interface Db extends DbPool {
    release(): Promise<void>;
    execute( query: {
        name?: string;
        text: string;
        values: any // TODO fix type(string | Date)[]
      }): Promise<any>;
    format_nd_execute( query: {
        name?: string;
        text: string;
        values: any // TODO fix type(string | Date)[]
      }): Promise<any>;
}

 export type LockManagerDTO = {
    lockKey: string;
    owner: string;
    expiryInSec: number;
 }

 export type LockManagerResponse = {
    lockKey: string;
    acquired: boolean;
 }

  export type LockObject = {
      key: string;
      owner: string;
      expiration: Date;
      created_at: Date;
  }
