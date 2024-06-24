import * as sinon from "sinon"
import * as chai from "chai"
import { readParams } from "../src/bootstrap.js"
import { Config, ModuleConfig } from "../src/config.js"
import { PgConfig } from "../src/modules/pg/config.js"
import { KafkaConfig } from "../src/modules/kafka/config.js"

describe("Tests for configuation loader", () => {
  const sandbox = sinon.createSandbox()

  afterEach(() => {
    sandbox.restore()
  })

  it("Should throw error when node arguments are incorrect", () => {
    sandbox.stub(process, "argv").value([ Config.PARAM_DRY_RUN, "true", Config.PARAM_ENABLED_MODULES ])
    chai.expect(() => readParams()).throw("Invalid parameters format. Expected format is: \"--parameter-name parameter-value\"")
  })

  it("Should load simple config with PG and Kafka from node arguments", () => {
    const args = [ "skip1", "skip2",
      Config.PARAM_DRY_RUN, "true",
      Config.PARAM_ENABLED_MODULES, `${PgConfig.MODULE_NAME},${KafkaConfig.MODULE_NAME}`,
      Config.PARAM_RETENTION_PERIOD, "2days",
      Config.PARAM_TIMESTAMP_PATTERN, "some-pattern",

      PgConfig.PARAM_PGDATABASE, "db-name",
      PgConfig.PARAM_PGHOST, "localhost",
      PgConfig.PARAM_PGUSER, "db-user",
      PgConfig.PARAM_PGPASSWORD, "db-user-pw",

      KafkaConfig.PARAM_BROKERS, "localhost1,localhost2",
      KafkaConfig.PARAM_CLIENT_ID, "clientid",
      KafkaConfig.PARAM_USERNAME, "kafka-user",
      KafkaConfig.PARAM_PASSWORD, "kafka-user-pw",
      KafkaConfig.PARAM_SASL_MECHANISM, "scram-sha-512"
    ]

    sandbox.stub(process, "argv").value(args)
    const config = readParams()

    chai.expect(config).be.not.null
    chai.expect(config).be.not.undefined
    chai.expect(config.dryRun).be.true
    chai.expect(config.retentionMinutes).eq(2_880)
    chai.expect(config.timestampPattern).deep.eq(/some-pattern/)

    chai.expect(config.enabledModules).be.not.null
    chai.expect(config.enabledModules).be.not.undefined
    chai.expect(config.enabledModules.size).eq(2)
    chai.expect(config.enabledModules.has(PgConfig.MODULE_NAME)).be.true

    const pgm: ModuleConfig = config.enabledModules.get(PgConfig.MODULE_NAME)
    chai.expect(pgm.name).eq(PgConfig.MODULE_NAME)
    chai.expect(pgm.ids.length).eq(1)
    chai.expect(pgm.ids[0]).eq(PgConfig.MODULE_NAME)

    const km: ModuleConfig = config.enabledModules.get(KafkaConfig.MODULE_NAME)
    chai.expect(config.enabledModules.has(KafkaConfig.MODULE_NAME)).be.true
    chai.expect(km.name).eq(KafkaConfig.MODULE_NAME)
    chai.expect(km.ids.length).eq(1)
    chai.expect(km.ids[0]).eq(KafkaConfig.MODULE_NAME)

    chai.expect(config.pgModules).be.not.null
    chai.expect(config.pgModules).be.not.undefined
    chai.expect(config.pgModules.size).eq(1)
    chai.expect(config.pgModules.has(PgConfig.MODULE_NAME)).be.true

    const pgc: PgConfig = config.pgModules.get(PgConfig.MODULE_NAME)
    chai.expect(pgc.moduleName).eq(PgConfig.MODULE_NAME)
    chai.expect(pgc.host).eq("localhost")
    chai.expect(pgc.port).eq(5432)
    chai.expect(pgc.database).eq("db-name")
    chai.expect(pgc.username).eq("db-user")
    chai.expect(pgc.password).eq("db-user-pw")

    chai.expect(config.kafkaModules).be.not.null
    chai.expect(config.kafkaModules).be.not.undefined
    chai.expect(config.kafkaModules.size).eq(1)
    chai.expect(config.kafkaModules.has(KafkaConfig.MODULE_NAME)).be.true

    const kc: KafkaConfig = config.kafkaModules.get(KafkaConfig.MODULE_NAME)
    chai.expect(kc.brokers).deep.eq([ "localhost1:9092", "localhost2:9092" ])
    chai.expect(kc.clientId).eq("clientid")
    chai.expect(kc.username).eq("kafka-user")
    chai.expect(kc.password).eq("kafka-user-pw")
    chai.expect(kc.saslMechanism).eq("scram-sha-512")
  })
})