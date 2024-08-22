import { ElasticsearchConfig } from "./modules/elasticsearch/config.js"
import { KafkaConfig } from "./modules/kafka/config.js"
import { PgConfig } from "./modules/pg/config.js"

export type ValueReader = (params: Map<string, string>, param: string, isRequired?: boolean, defaultValue?: any) => any | undefined

export class Config {
  // The format for value can be simple or extended
  // Simple format:   --enabled-modules postgres,kafka
  // Extended formats: --enabled-modules postgres=pg1;pg2,kafka
  //                   --enabled-modules postgres,kafka=k1;k2
  //                   --enabled-modules postgres=pg1;pg2,kafka=k1;k2
  static PARAM_ENABLED_MODULES: string = "--enabled-modules"

  static PARAM_DRY_RUN: string = "--dry-run"
  static PARAM_RETENTION_PERIOD: string = "--retention-period"
  static PARAM_TIMESTAMP_PATTERN: string = "--timestamp-pattern"
  static DEFAULT_TIMESTAMP_PATTERN: RegExp = /^.*pit.*(ts[0-9]{14,14}).*$/
  static DEFAULT_RETENTION_PERIOD: string = "3days"

  constructor(
    readonly enabledModules: Map<string, ModuleConfig>,
    readonly pgModules: Map<string, PgConfig>,
    readonly kafkaModules: Map<string, KafkaConfig>,
    readonly elasticsearchModules: Map<string, ElasticsearchConfig>,
    readonly timestampPattern: RegExp,
    readonly retentionMinutes: number,
    readonly dryRun: boolean
  ) { }

  isModuleEnabled = (moduleName: string): boolean => {
    return this.enabledModules.has(moduleName)
  }

  static parseRetention = (value: string): number => {
    if (new RegExp(/^1day$/).test(value)) return 24 * 60
    if (new RegExp(/^\d{1,}days$/).test(value)) return parseInt(value.replaceAll("days", "")) * 24 * 60

    if (new RegExp(/^1hour$/).test(value)) return 60
    if (new RegExp(/^\d{1,}hours$/).test(value)) return parseInt(value.replaceAll("hours", "")) * 60

    if (new RegExp(/^1minute$/).test(value)) return 1
    if (new RegExp(/^\d{1,}minutes$/).test(value)) return parseInt(value.replaceAll("minutes", ""))

    throw new Error(`Invalid format for retention. Expected "<digit><unit>", got: ${ value }`)
  }
}

export class ModuleConfig {
  constructor(readonly name: string, readonly ids: Array<string>) {}
}

export const parseModules = (rawConfig: string): Map<string, ModuleConfig> => {
  // rawConfig = "postgres=pg1;pg2;pg3,kafka=k1;k2;k3,elastic"
  const supportedModules = [ PgConfig.MODULE_NAME, KafkaConfig.MODULE_NAME, ElasticsearchConfig.MODULE_NAME ]
  const rawModules = rawConfig.split(",")
  if (rawModules.length > 5) {
    // this is very unlikely scenario
    throw new Error(`Invalid format for modules. We only support up to 5 modules: ${rawConfig}`)
  }

  const parsedModules: Array<ModuleConfig> = rawModules
    .map(v => v.trim())
    .filter(v => v.length > 0)
    .map((rawModConfig) => {
      if (rawModConfig.indexOf("=") == -1) {
        // rawModConfig = 'elastic'
        // this is simple module
        return new ModuleConfig(rawModConfig, [rawModConfig])
      }

      // rawModConfig = 'postgres=pg1;pg2;pg3'
      // parse it into map of arrays
      const nameAndIds = rawModConfig.split("=").map(v => v.trim()).filter(v => v.length > 0)
      if ( nameAndIds.length != 2) {
        // unbalanced...
        throw new Error(`Invalid format for module config. The correct example is: modue=id1;id2;id3 Current value is: ${rawModConfig}`)
      }

      const name = nameAndIds[0]   // postgres
      const rawIds = nameAndIds[1] // pg1;pg2;pg3

      const ids = rawIds.split(";").map(v => v.trim()).filter(v => v.length > 0)
      if (ids.length == 0) {
        // unbalanced...
        throw new Error(`Invalid format of module ids. The correct example is: modue=id1;id2;id3 Current value is: ${rawModConfig}`)
      }

      const unique = new Set<string>(ids)
      if (unique.size < ids.length) throw new Error(`Invalid format of module ids. Values must be unique. The correct example is: modue=id1;id2;id3 Current value is: ${rawModConfig}`)

      return new ModuleConfig(name, ids)
    })

  const unique = new Set<string>()
  for (let moduleConfig of parsedModules.values()) {
    if (supportedModules.indexOf(moduleConfig.name) == -1) {
      throw new Error(`Unsupported module name: ${moduleConfig.name}. We only support the following modules: ${supportedModules}`)
    }
    if (unique.has(moduleConfig.name)) {
      throw new Error(`Invalid format of module names. Values must be unique. The correct example is: "module1=id1;id2;id3, module2" Current value is: ${rawConfig}`)
    }

    unique.add(moduleConfig.name)
  }

  const result = new Map<string, ModuleConfig>()
  for (let module of parsedModules) {
    result.set(module.name, module)
  }
  return result
}
