import * as chai from "chai"
import { ModuleConfig } from "../src/config.js"
import { PgConfig } from "../src/modules/pg/config.js"

describe("Tests for modules/pg/config.ts", () => {
  it("should load multiple PG configs", () => {
    const moduleConfig = new ModuleConfig("postgresql", [ "server1", "server2" ])
    const makeParam = (prefix: string, param: string): string => `--${prefix}-${param.substring(2)}`
    const params = new Map<string, string>([
      [ makeParam("server1", PgConfig.PARAM_PGDATABASE), "db1" ],
      [ makeParam("server1", PgConfig.PARAM_PGHOST), "localhost1" ],
      [ makeParam("server1", PgConfig.PARAM_PGUSER), "user1" ],
      [ makeParam("server1", PgConfig.PARAM_PGPASSWORD), "user-pw1" ],
      [ makeParam("server1", PgConfig.PARAM_PGPORT), "5432" ],
      [ makeParam("server2", PgConfig.PARAM_PGDATABASE), "db2" ],
      [ makeParam("server2", PgConfig.PARAM_PGHOST), "localhost2" ],
      [ makeParam("server2", PgConfig.PARAM_PGUSER), "user2" ],
      [ makeParam("server2", PgConfig.PARAM_PGPASSWORD), "user-pw2" ],
      [ makeParam("server2", PgConfig.PARAM_PGPORT), "5432" ],
    ])
    const valueReader = (_a: Map<string, string>, param: string, _b?: boolean, _c?: any): any | undefined => params.get(param)

    console.log(JSON.stringify(Object.fromEntries(params), null, 2))

    const config = PgConfig.loadAll(moduleConfig, params, valueReader)

    chai.expect(config).be.not.null
    chai.expect(config).be.not.undefined
    chai.expect(config.size).eq(2)
    chai.expect(config.has("server1")).be.true
    chai.expect(config.has("server2")).be.true

    chai.expect(config.get("server1").moduleName).eq("server1")
    chai.expect(config.get("server1").database).eq("db1")
    chai.expect(config.get("server1").host).eq("localhost1")
    chai.expect(config.get("server1").username).eq("user1")
    chai.expect(config.get("server1").password).eq("user-pw1")
    chai.expect(config.get("server1").port).eq(5432)

    chai.expect(config.get("server2").moduleName).eq("server2")
    chai.expect(config.get("server2").database).eq("db2")
    chai.expect(config.get("server2").host).eq("localhost2")
    chai.expect(config.get("server2").username).eq("user2")
    chai.expect(config.get("server2").password).eq("user-pw2")
    chai.expect(config.get("server2").port).eq(5432)
  })

  it("should enforce numeric port", () => {
    chai.expect(() => new PgConfig("m", "localhost", "cc", "d", "u", "p")).to.Throw("The port should be a number: cc")
  })
})