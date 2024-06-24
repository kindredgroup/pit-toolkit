import { ModuleConfig, ValueReader } from "../../config.js"

export class KafkaConfig {
  static MODULE_NAME: string = "kafka"

  static PARAM_BROKERS: string = "--kafka-brokers"
  static PARAM_PORT: string = "--kafka-port"
  static PARAM_CLIENT_ID: string = "--kafka-client-id"
  static PARAM_USERNAME: string = "--kafka-username"
  static PARAM_PASSWORD: string = "--kafka-password"
  static PARAM_SASL_MECHANISM: string = "--kafka-sasl-mechanism"

  readonly brokers: Array<string>

  constructor(
    readonly moduleName: string,
    private readonly brokersCsv: string,
    readonly clientId: string,
    readonly username: string,
    readonly password: string,
    private readonly portAsText?: string,
    readonly saslMechanism?: string,
  ) {
    const hosts = brokersCsv
      .split(",")
      .map(it => it.trim())

    const parsed = new Array<string>()
    for (let host of hosts) {
      if (host.indexOf(":") === -1) {
        if (!portAsText || (typeof(portAsText) === 'string' && (portAsText.trim().length === 0 || isNaN(parseInt(portAsText))))) {
          throw Error(`The broker host should be given with port or default port should be provided. Cannot use: "${ host }" without port`)
        }
        host = `${ host }:${ portAsText }`
      }
      parsed.push(host)
    }
    this.brokers = parsed
  }

  static loadAll = (moduleConfig: ModuleConfig, params: Map<string, string>, valueReader: ValueReader): Map<string, KafkaConfig> => {
    const result = new Map<string, KafkaConfig>()
    for (let id of moduleConfig.ids) {
      result.set(id, KafkaConfig.loadOne(id, params, valueReader))
    }

    return result
  }

  private static loadOne = (name: string, params: Map<string, string>, valueReader: ValueReader): KafkaConfig => {
    const getParamName = (param: string, prefix: string): string => prefix.length == 0 ? param : `--${prefix}-${param.substring(2)}`
    
    const prefix = name === KafkaConfig.MODULE_NAME ? "" : name
    return new KafkaConfig(
      name,
      valueReader(params, getParamName(KafkaConfig.PARAM_BROKERS, prefix), true),
      valueReader(params, getParamName(KafkaConfig.PARAM_CLIENT_ID, prefix), true),
      valueReader(params, getParamName(KafkaConfig.PARAM_USERNAME, prefix)),
      valueReader(params, getParamName(KafkaConfig.PARAM_PASSWORD, prefix), true),
      valueReader(params, getParamName(KafkaConfig.PARAM_PORT, prefix), true, 9092),
      valueReader(params, getParamName(KafkaConfig.PARAM_SASL_MECHANISM, prefix))
    )
  }
}
