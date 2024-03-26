import * as sinon from "sinon"
import * as chai from "chai"

import { PgConfig, KafkaConfig, Config } from "../src/config.js"
import { fnReadValue, readParams } from "../src/bootstrap.js"
import { logger } from "../src/logger.js"

const requiredParams = [
  PgConfig.PARAM_PGHOST, "127.0.0.1",
  PgConfig.PARAM_PGPORT, 1000,
  PgConfig.PARAM_PGDATABASE, "postgres",
  PgConfig.PARAM_PGUSER, "user",
  PgConfig.PARAM_PGPASSWORD, "no-password",

  KafkaConfig.PARAM_BROKERS, "127.0.0.2, 127.0.0.3",
  KafkaConfig.PARAM_PORT, 1001,
  KafkaConfig.PARAM_CLIENT_ID, "test-client-id",
]

describe("bootstrap with correct configs", () => {
  const sandbox = sinon.createSandbox()

  const optionalParams = [
    KafkaConfig.PARAM_SASL_MECHANISM, "saslm",
    KafkaConfig.PARAM_USERNAME, "admin",
    KafkaConfig.PARAM_PASSWORD, "no-password",

    Config.PARAM_RETENTION_PERIOD, "2minutes",
    Config.PARAM_TIMESTAMP_PATTERN, "^.*$"
  ]

  const mockParams = (stanbox: sinon.SinonSandbox, process: any, property: string, values: Array<string | number>) => {
    const name = (p: string): string => {
      return p.replaceAll("--", "").replaceAll("-", "_").toUpperCase()
    }

    if (property !== "env") {
      // setup as array
      sandbox.stub(process, property).value(values)
    } else {
      // setup as map
      const map = {}
      for (let i = 0; i <= values.length; i+=2) {
        map[name(`${ values[i] }`)] = values[i + 1]
      }
      sandbox.stub(process, property).value(map)
    }
  }

  const evaluatePopulated = (config: Config, optionals?: Map<string, string | Map<string, string | number>>) => {
    chai.expect(config.pg.host).eq("127.0.0.1")
    chai.expect(config.pg.port).eq(1000)
    chai.expect(config.pg.username).eq("user")
    chai.expect(config.pg.password).eq("no-password")
    chai.expect(config.pg.database).eq("postgres")

    chai.expect(config.kafka.brokers).deep.eq([ "127.0.0.2:1001", "127.0.0.3:1001"] )
    chai.expect(config.kafka.clientId).eq("test-client-id")
    if (!optionals) return

    const evalObjects = (expected: Map<string, any>, actual: any) => {
      for (const key of expected.keys()) {
        logger.info("evalObjects(), key=%s", key)
        let value = undefined
        for (const [p, v] of Object.entries(actual)) {
          if (p !== key) continue
          value = v
          break
        }
        chai.expect(value).deep.eq(expected.get(key))
      }
    }

    const optKafka = optionals.get("kafka") as Map<string, string | number>
    if (optKafka) evalObjects(optKafka, config.kafka)

    optionals.delete("kafka")
    evalObjects(optionals, config)
  }

  it("readParams() should return populated config", () => {
    const allParams: Array<string | number> = ["skip-first", ""]
    mockParams(sandbox, process, 'argv', allParams.concat(requiredParams, optionalParams))
    sandbox.stub(process, 'env').value({})

    const config = readParams()
    evaluatePopulated(config)
  })

  it("readParams() should populate config from env", () => {
    sandbox.stub(process, 'argv').value([ PgConfig.PARAM_PGDATABASE, "" ])

    const allParams: Array<string | number> = []
    mockParams(sandbox, process, 'env', allParams.concat(requiredParams, optionalParams))

    const config = readParams()
    evaluatePopulated(config)
  })

  it("readParams() should use default values for optional params", () => {
    sandbox.stub(process, 'env').value({})
    const params: Array<string | number> = ["skip-first", ""]
    mockParams(sandbox, process, 'argv', params.concat(requiredParams))

    const config = readParams()
    evaluatePopulated(
      config,
      new Map<string, any>([
        [ "retentionMinutes", 3 * 24 * 60 ],
        [ "timestampPattern", Config.DEFAULT_TIMESTAMP_PATTERN ]
      ])
    )
  })

  afterEach(() => {
    sandbox.restore()
  })
})

describe("bootstrap with invalid configs", () => {
  const sandbox = sinon.createSandbox()

  it("readParams() should throw error when param is passed without value", () => {
    sandbox.stub(process, 'env').value({})
    sandbox.stub(process, 'argv').value([ KafkaConfig.PARAM_BROKERS, "some brokers", Config.PARAM_RETENTION_PERIOD ])
    chai.expect(() => readParams()).to.throw("Invalid parameters format. Expected format is: \"--parameter-name parameter-value\"")
  })

  it("fnReadValue() should throw error when required param is missing", () => {
    const params = new Map( [ [ "param1", "value1" ], [ "param3", "value3" ] ])
    chai.expect(() => fnReadValue(params, "param2", true )).to.throw("Missing required parameter \"param2\" or env variable: PARAM2")
  })

  afterEach(() => {
    sandbox.restore()
  })
})