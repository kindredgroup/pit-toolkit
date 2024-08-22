import * as chai from "chai"
import { ElasticsearchConfig } from "../src/modules/elasticsearch/config.js"
import { ModuleConfig } from "../src/config.js"

describe("Tests for modules/elasticsearch/config.ts", () => {
  it("should load multiple elasticsearch configs", () => {
    const moduleConfig = new ModuleConfig("elasticsearch", [ "server1", "server2" ])
    const makeParam = (prefix: string, param: string): string => `--${prefix}-${param.substring(2)}`
    const params = new Map<string, string>([
      [ makeParam("server1", ElasticsearchConfig.PARAM_BROKER_PROTOCOL), "http" ],
      [ makeParam("server1", ElasticsearchConfig.PARAM_BROKERS), "localhost" ],
      [ makeParam("server1", ElasticsearchConfig.PARAM_PORT), "9200" ],
      [ makeParam("server1", ElasticsearchConfig.PARAM_USERNAME), "admin" ],
      [ makeParam("server1", ElasticsearchConfig.PARAM_PASSWORD), "admin-pwd" ],

      [ makeParam("server2", ElasticsearchConfig.PARAM_BROKER_PROTOCOL), "http" ],
      [ makeParam("server2", ElasticsearchConfig.PARAM_BROKERS), "localhost2" ],
      [ makeParam("server2", ElasticsearchConfig.PARAM_PORT), "9200" ],
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
    chai.expect(config.get("server1").brokerProtocol).eq("http")
    chai.expect(config.get("server1").brokers).deep.eq("localhost")
    chai.expect(config.get("server1").port).deep.eq("9200")
    chai.expect(config.get("server1").username).eq("admin")
    chai.expect(config.get("server1").password).eq("admin-pwd")

    chai.expect(config.get("server2").moduleName).eq("server2")
    chai.expect(config.get("server2").brokerProtocol).eq("http")
    chai.expect(config.get("server2").brokers).deep.eq("localhost2")
    chai.expect(config.get("server2").port).deep.eq("9200")
    chai.expect(config.get("server2").username).eq("admin2")
    chai.expect(config.get("server2").password).eq("admin2-pwd")
  })

  it("should load elasticsearch config for single server", () => {
    const moduleConfig = new ModuleConfig("elasticsearch", [ "elasticsearch" ])
    const params = new Map<string, string>([
      [ ElasticsearchConfig.PARAM_BROKER_PROTOCOL, "http" ],
      [ ElasticsearchConfig.PARAM_BROKERS, "localhost" ],
      [ ElasticsearchConfig.PARAM_PORT, "9200" ],
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
    chai.expect(config.get("elasticsearch").brokerProtocol).eq("http")
    chai.expect(config.get("elasticsearch").brokers).deep.eq("localhost")
    chai.expect(config.get("elasticsearch").port).deep.eq("9200")
    chai.expect(config.get("elasticsearch").username).eq("admin")
    chai.expect(config.get("elasticsearch").password).eq("admin-pwd")
  })

})