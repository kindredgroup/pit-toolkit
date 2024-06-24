import { ModuleConfig, ValueReader } from "../../config.js"

export class PgConfig {
  static MODULE_NAME: string = "postgresql"

  static PARAM_PGHOST: string = "--pghost"
  static PARAM_PGPORT: string = "--pgport"
  static PARAM_PGDATABASE: string = "--pgdatabase"
  static PARAM_PGUSER: string = "--pguser"
  static PARAM_PGPASSWORD: string = "--pgpassword"

  readonly port: number

  constructor(
    readonly moduleName: string,
    readonly host: string,
    private readonly portAsText: string,
    readonly database: string,
    readonly username: string,
    readonly password: string
  ) {
    this.port = parseInt(portAsText)
    if (isNaN(this.port)) throw new Error(`The port should be a number: ${ portAsText }`)
  }

  static loadAll = (moduleConfig: ModuleConfig, params: Map<string, string>, valueReader: ValueReader): Map<string, PgConfig> => {
    const result = new Map<string, PgConfig>()
    for (let id of moduleConfig.ids) {
      result.set(id, PgConfig.loadOne(id, params, valueReader))
    }

    return result
  }

  private static loadOne = (name: string, params: Map<string, string>, valueReader: ValueReader): PgConfig => {
    const getParamName = (param: string, prefix: string): string => prefix.length == 0 ? param : `--${prefix}-${param.substring(2)}`
    const prefix = name === PgConfig.MODULE_NAME ? "" : name
    return new PgConfig(
      name,
      valueReader(params, getParamName(PgConfig.PARAM_PGHOST, prefix), true),
      valueReader(params, getParamName(PgConfig.PARAM_PGPORT, prefix), true, 5432),
      valueReader(params, getParamName(PgConfig.PARAM_PGDATABASE, prefix), true),
      valueReader(params, getParamName(PgConfig.PARAM_PGUSER, prefix), true),
      valueReader(params, getParamName(PgConfig.PARAM_PGPASSWORD, prefix), true)
    )
  }
}