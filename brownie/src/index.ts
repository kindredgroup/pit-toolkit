import { logger } from "./logger.js"

import { readParams } from "./bootstrap.js"
import { Config } from "./config.js"
import { KafkaConfig } from "./modules/kafka/config.js"
import { PgConfig } from "./modules/pg/config.js"
import * as KafkaModule from "./modules/kafka/implementation.js"
import * as PgModule from "./modules/pg/implementation.js"
import * as ElasticsearchModule from "./modules//elasticsearch/implementation.js"
import { ElasticsearchConfig } from "./modules/elasticsearch/config.js"

const main = async () => {
  const rawParams = process.argv.slice(2)
  if (rawParams.length % 2 !== 0) {
      throw new Error("Invalid parameters format. Expected format is: \"--parameter-name parameter-value\"")
  }
  const params = new Map<string, string>()
  for (let i = 0; i < rawParams.length; i += 2) {
    params.set(rawParams[i], rawParams[i + 1])
  }

  const config = readParams()
  printConfig(config)

  if (config.isModuleEnabled(PgConfig.MODULE_NAME)) {
    for (let [moduleName, moduleConfig] of config.pgModules.entries()) {
      await PgModule.clean(moduleName, config, moduleConfig)
    }
  }

  if (config.isModuleEnabled(KafkaConfig.MODULE_NAME)) {
    for (let [moduleName, moduleConfig] of config.kafkaModules.entries()) {
      await KafkaModule.clean(moduleName, config, moduleConfig)
    }
  }

  if (config.isModuleEnabled(ElasticsearchConfig.MODULE_NAME)) {
    for (let [moduleName, moduleConfig] of config.elasticsearchModules.entries()) {
      await ElasticsearchModule.clean(moduleName, config, moduleConfig)
    }
  }
}

const printConfig = (config: Config) => {
  const cleanedConfig = { ...config, pgModules: {}, kafkaModules: {}, enabledModules: Object.fromEntries(config.enabledModules) }
  for (let module of config.pgModules.keys()) {
    cleanedConfig.pgModules[module] = { ...config.pgModules.get(module), password: "*** hidden ***" }
  }
  for (let module of config.kafkaModules.keys()) {
    cleanedConfig.kafkaModules[module] = { ...config.kafkaModules.get(module), password: "*** hidden ***" }
  }
  for (let module of config.elasticsearchModules.keys()) {
    cleanedConfig.elasticsearchModules[module] = { ...config.elasticsearchModules.get(module), password: "*** hidden ***" }
  }
  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...cleanedConfig, timestampPattern: config.timestampPattern.toString() }, null, 2))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })