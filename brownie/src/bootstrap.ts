import { logger } from "./logger.js"
import * as cfg from  "./config.js"
import { PgConfig } from "./modules/pg/config.js"
import { KafkaConfig } from "./modules/kafka/config.js"
import { ElasticsearchConfig } from "./modules/elasticsearch/config.js"
import { readParameterValue } from "./utils.js"

export const readParams = (): cfg.Config => {
  logger.debug("readParams()... ARGS \n%s", JSON.stringify(process.argv, null, 2))
  logger.debug("readParams()... ENV: \n%s", JSON.stringify(process.env, null, 2))

  const rawParams = process.argv.slice(2)
  if (rawParams.length % 2 !== 0) {
      throw new Error("Invalid parameters format. Expected format is: \"--parameter-name parameter-value\"")
  }
  const params = new Map<string, string>()
  for (let i = 0; i < rawParams.length; i += 2) {
    params.set(rawParams[i], rawParams[i + 1])
  }

  logger.info("Application started with arguments: \n%s", JSON.stringify(Object.fromEntries(params), null, 2))

  const enabledModules: Map<string, cfg.ModuleConfig> = cfg.parseModules(readParameterValue(params, cfg.Config.PARAM_ENABLED_MODULES, true))
  let pgModules = new Map<string, PgConfig>()
  let kafkaModules = new Map<string, KafkaConfig>()
  let elasticsearchModules = new Map<string, ElasticsearchConfig>()

  if (enabledModules.has(PgConfig.MODULE_NAME)) {
    pgModules = PgConfig.loadAll(enabledModules.get(PgConfig.MODULE_NAME), params, readParameterValue)
  }

  if (enabledModules.has(KafkaConfig.MODULE_NAME)) {
    kafkaModules = KafkaConfig.loadAll(enabledModules.get(KafkaConfig.MODULE_NAME), params, readParameterValue)
  }

  if (enabledModules.has(ElasticsearchConfig.MODULE_NAME)) {
    elasticsearchModules = ElasticsearchConfig.loadAll(enabledModules.get(ElasticsearchConfig.MODULE_NAME), params, readParameterValue)
  }

  return new cfg.Config(
    enabledModules,
    pgModules,
    kafkaModules,
    elasticsearchModules,
    new RegExp(readParameterValue(params, cfg.Config.PARAM_TIMESTAMP_PATTERN, true, cfg.Config.DEFAULT_TIMESTAMP_PATTERN)),
    cfg.Config.parseRetention(readParameterValue(params, cfg.Config.PARAM_RETENTION_PERIOD, true, cfg.Config.DEFAULT_RETENTION_PERIOD)),
    readParameterValue(params, cfg.Config.PARAM_DRY_RUN, false, false) === "true"
  )
}