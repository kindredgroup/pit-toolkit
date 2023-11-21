import pg, { PoolConfig } from "pg";
import {Db} from "./db.js";
import {getParam} from "../configuration.js";
import format from "pg-format";
export class PostgresDb implements Db {
  private pg_pool: pg.Pool;
  // private pool_client: pg.PoolClient;

  constructor() {
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
    this.pg_pool = new pg.Pool(config);
  }

  release(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // async connect(){
  //   this.pool_client =  await this.pg_pool.connect();
  //   // return this.pool_client;
  // }

  async disconnect(): Promise<void> {
    return await this.pg_pool.end();
  }

  async execute(query: {
    name?: string;
    text: string;
    values: any; //(string | Date)[][];
  }): Promise<any> {
    const start = Date.now();
    let client = await this.pg_pool.connect();
    let result;
    try {
      result = await client.query(query as any);
    } catch (error) {
      console.error(error);
      client.release();
      return result;
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
    let client = await this.pg_pool.connect();

    // await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')

    let result;
    let sql;
    try {
      sql = format(query.text, query.values);
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
