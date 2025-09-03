import { ModuleConfig, ValueReader } from "../../config.js"

export class ElasticsearchConfig {
  static MODULE_NAME: string = "elasticsearch"

  static PARAM_URL: string = "--elasticsearch-url"
  static PARAM_USERNAME: string = "--elasticsearch-username"
  static PARAM_PASSWORD: string = "--elasticsearch-password"

  constructor(
    readonly moduleName: string,
    readonly url: string,
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
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_URL, prefix), true),
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_USERNAME, prefix), true),
      valueReader(params, getParamName(ElasticsearchConfig.PARAM_PASSWORD, prefix), true),
    )
  }
}
