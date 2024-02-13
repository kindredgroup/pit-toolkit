
export interface DbConfig {
    user: string
    host: string
    database: string
    password: string
    port: number
}

export interface DbPoolConfig {
    max: number
    min: number
    connectionTimeoutMillis: number
    idleTimeoutMillis: number
}

export interface DbPool {
    disconnect(): Promise<void>
}


export interface Db extends DbPool {
    release(): Promise<void>
    execute( query: {
        name?: string
        text: string
        values: any // TODO fix type(string | Date)[]
      }): Promise<any>
    format_nd_execute( query: {
        name?: string
        text: string
        values: any // TODO fix type(string | Date)[]
      }): Promise<any>
}

 export type LockAcquireObject = {
    lockId: string
    owner: string
    expiryInSec?: number
 }

 export type LockMetadata = {
  lockOwner: string
  lockExpiry: Date
  lockCreated: Date
 }


 export type LockManagerResponse = {
    lockId: string
    acquired: boolean
    lockExpiry?: Date
 }

  export type LockKeepAlive = {
    lockIds: Array<string>
    owner: string
  }

  export type ReleaseLocks = {
    lockIds: Array<string>
    owner: string
  }
