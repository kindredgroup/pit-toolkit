import { ModuleConfig, ValueReader } from "../../config.js"

export class ElasticsearchConfig {
  static MODULE_NAME: string = "elasticsearch"

  static PARAM_BROKER_PROTOCOL: string = "--elasticsearch-broker-protocol"
  static PARAM_BROKERS: string = "--elasticsearch-brokers"
  static PARAM_PORT: string = "--elasticsearch-port"
  static PARAM_USERNAME: string = "--elasticsearch-username"
  static PARAM_PASSWORD: string = "--elasticsearch-password"

  constructor(
    readonly moduleName: string,
    readonly brokerProtocol: string,
    readonly brokers: string,
    readonly port: string,
    readonly username: string,
    readonly password: string,
  ) {}

  static loadAll = (moduleConfig: ModuleConfig, params: Map<string, string>, valueReader: ValueReader): Map<string, ElasticsearchConfig> => {
    const result = new Map<string, ElasticsearchConfig>()
    for (let id of moduleConfig.ids) {
      result.set(id, ElasticsearchConfig.loadOne(id, params, valueReader))
    }

    return result
  }

  private static loadOne = (name: string, params: Map<string, string>, valueReader: ValueReader): ElasticsearchConfig => {
    const getParamName = (param: string, prefix: string): string => prefix.length == 0 ? param : `--${prefix}-${param.substring(2)}`

    const prefix = name === ElasticsearchConfig.MODULE_NAME ? "" : name
    return new ElasticsearchConfig(
      name,
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_BROKER_PROTOCOL, prefix), true, "https"),
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_BROKERS, prefix), true),
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_PORT, prefix), true),
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_USERNAME, prefix), true),
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_PASSWORD, prefix), true),
    )
  }
}
