import * as chai from "chai"
import { KafkaConfig } from "../src/modules/kafka/config.js"
import { ModuleConfig } from "../src/config.js"

describe("Tests for modules/kafka/config.ts", () => {
  it("should load multiple kafka configs", () => {
    const moduleConfig = new ModuleConfig("kafka", [ "server1", "server2" ])
    const makeParam = (prefix: string, param: string): string => `--${prefix}-${param.substring(2)}`
    const params = new Map<string, string>([
      [ makeParam("server1", KafkaConfig.PARAM_BROKERS), "localhost1:9092,localhost2:9092" ],
      [ makeParam("server1", KafkaConfig.PARAM_CLIENT_ID), "clientid" ],
      [ makeParam("server1", KafkaConfig.PARAM_USERNAME), "kafka-user" ],
      [ makeParam("server1", KafkaConfig.PARAM_PASSWORD), "kafka-user-pw" ],
      [ makeParam("server1", KafkaConfig.PARAM_SASL_MECHANISM), "scram-sha-512" ],
      [ makeParam("server2", KafkaConfig.PARAM_BROKERS), "localhost21:9092,localhost22:9092" ],
      [ makeParam("server2", KafkaConfig.PARAM_CLIENT_ID), "clientid2" ],
      [ makeParam("server2", KafkaConfig.PARAM_USERNAME), "kafka-user2" ],
      [ makeParam("server2", KafkaConfig.PARAM_PASSWORD), "kafka-user-pw2" ],
      [ makeParam("server2", KafkaConfig.PARAM_SASL_MECHANISM), "scram-sha-512" ]
    ])
    const valueReader = (_a: Map<string, string>, param: string, _b?: boolean, _c?: any): any | undefined => params.get(param)

    console.log(JSON.stringify(Object.fromEntries(params), null, 2))

    const config = KafkaConfig.loadAll(moduleConfig, params, valueReader)

    chai.expect(config).be.not.null
    chai.expect(config).be.not.undefined
    chai.expect(config.size).eq(2)
    chai.expect(config.has("server1")).be.true
    chai.expect(config.has("server2")).be.true

    chai.expect(config.get("server1").moduleName).eq("server1")
    chai.expect(config.get("server1").brokers).deep.eq([ "localhost1:9092", "localhost2:9092" ])
    chai.expect(config.get("server1").clientId).eq("clientid")
    chai.expect(config.get("server1").username).eq("kafka-user")
    chai.expect(config.get("server1").password).eq("kafka-user-pw")
    chai.expect(config.get("server1").saslMechanism).eq("scram-sha-512")

    chai.expect(config.get("server2").moduleName).eq("server2")
    chai.expect(config.get("server2").brokers).deep.eq([ "localhost21:9092", "localhost22:9092" ])
    chai.expect(config.get("server2").clientId).eq("clientid2")
    chai.expect(config.get("server2").username).eq("kafka-user2")
    chai.expect(config.get("server2").password).eq("kafka-user-pw2")
    chai.expect(config.get("server2").saslMechanism).eq("scram-sha-512")
  })

  it("should enforce numeric port", () => {
    chai.expect(() => new KafkaConfig("m", "localhost", "c", "u", "p")).to.Throw("The broker host should be given with port or default port should be provided. Cannot use: \"localhost\" without port")
    chai.expect(() => new KafkaConfig("m", "localhost", "c", "u", "p", "abc")).to.Throw("The broker host should be given with port or default port should be provided. Cannot use: \"localhost\" without port")
  })
})