import { logger } from "./logger.js"
import { Config, PgConfig, KafkaConfig } from  "./config.js"

// This is visible for testing only
export const fnReadValue = (params: Map<string, string>, param: string, isRequired?: boolean, defaultValue?: any): any | undefined => {
  const value = params.get(param)
  if (value === undefined || (`${ value }`.trim().length == 0)) {
    const envName = param.replaceAll("--", "").replaceAll("-", "_").toUpperCase()
    logger.debug("fnReadValue(): Cannot find parameter '%s'. Reading environment variable: %s", param, envName)

    const envValue = process.env[envName]
    if (!envValue && !defaultValue && isRequired) throw new Error(`Missing required parameter "${ param }" or env variable: ${ envName }`)
    if (envValue) {
      logger.info("fnReadValue(): Parameter '%s' was loaded from env.%s", param, envName)
      return envValue
    }

    if (!isRequired) {
      logger.info("fnReadValue(): Parameter '%s' is optional, skipping...", param)
      return undefined
    }

    logger.info("fnReadValue(): Cannot find env variable '%s'. Fallback to default value: '%s'", envName, defaultValue)
    return defaultValue
  }

  return value
}

export const readParams = (): Config => {
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

  const enabledModules = fnReadValue(params, Config.PARAM_ENABLED_MODULES)
  let pgConfig: PgConfig | null = null
  if (Config.isModuleEnabled(enabledModules, PgConfig.MODULE_NAME)) {
    pgConfig = new PgConfig(
      fnReadValue(params, PgConfig.PARAM_PGHOST),
      fnReadValue(params, PgConfig.PARAM_PGPORT),
      fnReadValue(params, PgConfig.PARAM_PGDATABASE),
      fnReadValue(params, PgConfig.PARAM_PGUSER),
      fnReadValue(params, PgConfig.PARAM_PGPASSWORD)
    )
  }

  let kafkaConfig: KafkaConfig | null = null
  if (Config.isModuleEnabled(enabledModules, KafkaConfig.MODULE_NAME)) {
    kafkaConfig = new KafkaConfig(
      fnReadValue(params, KafkaConfig.PARAM_BROKERS),
      fnReadValue(params, KafkaConfig.PARAM_CLIENT_ID),
      fnReadValue(params, KafkaConfig.PARAM_USERNAME, false),
      fnReadValue(params, KafkaConfig.PARAM_PASSWORD, false),
      fnReadValue(params, KafkaConfig.PARAM_PORT, false),
      fnReadValue(params, KafkaConfig.PARAM_SASL_MECHANISM, false)
    )
  }

  return new Config(
    enabledModules,
    pgConfig,
    kafkaConfig,
    new RegExp(fnReadValue(params, Config.PARAM_TIMESTAMP_PATTERN, true, Config.DEFAULT_TIMESTAMP_PATTERN)),
    Config.parseRetention(fnReadValue(params, Config.PARAM_RETENTION_PERIOD, true, Config.DEFAULT_RETENTION_PERIOD)),
    fnReadValue(params, Config.PARAM_DRY_RUN, false, false) === "true"
  )
}