import pg, { PoolConfig } from "pg"
import {Db} from "./db.js"
import {getConfigParam} from "../configuration.js"
import format from "pg-format"
import { logger } from "../logger.js"


let getPoolConfig = ()=>{
  let host = getConfigParam("PGHOST", "localhost") as string
  let port = getConfigParam("PGPORT", 5432) as number

  let user = getConfigParam("PGUSER", "") as string
  let password = getConfigParam("PGPASSWORD", "") as string
  let database = getConfigParam("PGDATABASE", "") as string
  let poolSizeMin = getConfigParam("PGMINPOOLSIZE", 10) as number

  const config:PoolConfig = {
    user,
    host,
    database,
    password,
    port,
    min: poolSizeMin,
  }
  return config
}


export class PostgresDb implements Db {
  private pg_pool: pg.Pool

  constructor() {
    let config = getPoolConfig()
    this.pg_pool = new pg.Pool(config)
  }

  release(): Promise<void> {
    throw new Error("Method not implemented.")
  }



  async connect(): Promise<void>{
    const client = new pg.Client(getPoolConfig())
    let client_connect = await client.connect()
    return client_connect
  }

  async disconnect(): Promise<void> {
    return await this.pg_pool.end()
  }

  async execute(query: {
    name?: string
    text: string
    values: any //(string | Date)[][]
  }): Promise<any> {
    const start = Date.now()
    let result
    let client
    try {
      client = await this.pg_pool.connect()
      await client.query("BEGIN")
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
      result = await client.query(query as any)
      await client.query("COMMIT")
    } catch (error) {
      logger.error("Error from pg.execute()::", error)
      await client.query("ROLLBACK")
      throw error
    }finally{
       client?.release()
    }
    const in_duration = Date.now() - start
    logger.debug("executed query %s in duration %s millis and rows returned %s",
      query,
      in_duration,
      result.rowCount,
    )
    return result
  }

  async format_nd_execute(query: {
    text: string
    values: any
  }): Promise<any> {
    const start = Date.now()
    let client
    let result
    let sql
    try {
      client = await this.pg_pool.connect()
      sql = format(query.text, ...query.values)
      result = await client.query(sql as any)
    } catch (error) {
      logger.error(`Error executing ${sql} with ${error}`)
      result = error
    }
    const in_duration = Date.now() - start
    logger.info("executed query %s", {
      sql,
      in_duration,
      rows_returned: result.rowCount,
    })
    client.release()
    return result
  }
}
