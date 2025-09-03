import * as chai from "chai"
import { ModuleConfig } from "../src/config.js"
import { ElasticsearchConfig } from "../src/modules/elasticsearch/config.js"

describe("Tests for modules/elasticsearch/config.ts", () => {
  it("should load multiple elasticsearch configs", () => {
    const moduleConfig = new ModuleConfig("elasticsearch", [ "server1", "server2" ])
    const makeParam = (prefix: string, param: string): string => `--${prefix}-${param.substring(2)}`
    const params = new Map<string, string>([
      [ makeParam("server1", ElasticsearchConfig.PARAM_URL), "http://localhost:9200" ],
      [ makeParam("server1", ElasticsearchConfig.PARAM_USERNAME), "admin" ],
      [ makeParam("server1", ElasticsearchConfig.PARAM_PASSWORD), "admin-pwd" ],

      [ makeParam("server2", ElasticsearchConfig.PARAM_URL), "http://localhost2:9200" ],
      [ makeParam("server2", ElasticsearchConfig.PARAM_USERNAME), "admin2" ],
      [ makeParam("server2", ElasticsearchConfig.PARAM_USERNAME), "admin2" ],
      [ makeParam("server2", ElasticsearchConfig.PARAM_PASSWORD), "admin2-pwd" ],

    ])
    const valueReader = (_a: Map<string, string>, param: string, _b?: boolean, _c?: any): any | undefined => params.get(param)

    console.log(JSON.stringify(Object.fromEntries(params), null, 2))

    const config = ElasticsearchConfig.loadAll(moduleConfig, params, valueReader)

    chai.expect(config).be.not.null
    chai.expect(config).be.not.undefined
    chai.expect(config.size).eq(2)
    chai.expect(config.has("server1")).be.true
    chai.expect(config.has("server2")).be.true

    chai.expect(config.get("server1").moduleName).eq("server1")
    chai.expect(config.get("server1").url).eq("http://localhost:9200")
    chai.expect(config.get("server1").username).eq("admin")
    chai.expect(config.get("server1").password).eq("admin-pwd")

    chai.expect(config.get("server2").moduleName).eq("server2")
    chai.expect(config.get("server2").url).eq("http://localhost2:9200")
    chai.expect(config.get("server2").username).eq("admin2")
    chai.expect(config.get("server2").password).eq("admin2-pwd")
  })

  it("should load elasticsearch config for single server", () => {
    const moduleConfig = new ModuleConfig("elasticsearch", [ "elasticsearch" ])
    const params = new Map<string, string>([
      [ ElasticsearchConfig.PARAM_URL, "http://localhost:9200" ],
      [ ElasticsearchConfig.PARAM_USERNAME, "admin" ],
      [ ElasticsearchConfig.PARAM_PASSWORD, "admin-pwd" ],

    ])
    const valueReader = (_a: Map<string, string>, param: string, _b?: boolean, _c?: any): any | undefined => params.get(param)

    console.log(JSON.stringify(Object.fromEntries(params), null, 2))

    const config = ElasticsearchConfig.loadAll(moduleConfig, params, valueReader)

    chai.expect(config).be.not.null
    chai.expect(config).be.not.undefined
    chai.expect(config.size).eq(1)
    chai.expect(config.has("elasticsearch")).be.true

    chai.expect(config.get("elasticsearch").moduleName).eq("elasticsearch")
    chai.expect(config.get("elasticsearch").url).eq("http://localhost:9200")
    chai.expect(config.get("elasticsearch").username).eq("admin")
    chai.expect(config.get("elasticsearch").password).eq("admin-pwd")
  })

})