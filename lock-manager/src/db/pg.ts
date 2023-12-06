import pg, { PoolConfig } from "pg";
import {Db} from "./db.js";
import {getParam} from "../configuration.js";
import format from "pg-format";
import { logger } from "../logger.js";


let getPoolConfig = ()=>{
  let host = getParam("PGHOST", "localhost") as string;
  let port = getParam("PGPORT", 5432) as number;

  let user = getParam("PGUSER", "admin") as string;
  let password = getParam("PGPASSWORD", "admin") as string;
  let database = getParam("PGDATABASE", "lock_manager") as string;
  let poolSizeMax = getParam("PGMAXPOOLSIZE", 10) as number;
  let poolSizeMin = getParam("PGMINPOOLSIZE", 10) as number;
  // connection string
  // return `postgres://${user}:${password}@${hostName}:${port}/${db}`;

  const config:PoolConfig = {
    user,
    host,
    database,
    password,
    port,
    min: poolSizeMin,
  };
  return config;
}


export class PostgresDb implements Db {
  private pg_pool: pg.Pool;
  // private pool_client: pg.PoolClient;

  constructor() {
    let config = getPoolConfig();
    logger.debug("connection config", config);
    this.pg_pool = new pg.Pool(config);
  }

  release(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  

  async connect(): Promise<void>{
    const client = new pg.Client(getPoolConfig());
    let client_connect = await client.connect();
    return client_connect;
  }

  async disconnect(): Promise<void> {
    return await this.pg_pool.end();
  }

  async execute(query: {
    name?: string;
    text: string;
    values: any; //(string | Date)[][];
  }): Promise<any> {
    const start = Date.now();
    let result;
    let client ;
    try {
      logger.info("query", query);
      client = await this.pg_pool.connect();
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      result = await client.query(query as any);
      await client.query("COMMIT");
    } catch (error) {
      console.info("Error executing query", error);
      console.error("Error from pg::", error);
      client.release();
      return error;
    }
    const in_duration = Date.now() - start;
    // TODO add winston log
    console.info("executed query", {
      query,
      in_duration,
      rows_returned: result.rowCount,
    });
    client.release();
    return result;
  }

  async format_nd_execute(query: {
    text: string;
    values: any; //(string | Date)[][];
  }): Promise<any> {
    const start = Date.now();
    let client ;

    // await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    
    let result;
    let sql;
    try {
      client = await this.pg_pool.connect();
      sql = format(query.text, ...query.values);
      result = await client.query(sql as any);
    } catch (error) {
      console.error(`Error executing ${sql} with ${error}`);
      result = error;
    }
    const in_duration = Date.now() - start;
    // TODO add winston log
    console.info("executed query", {
      sql,
      in_duration,
      rows_returned: result.rowCount,
    });
    client.release();
    return result;
  }
}
