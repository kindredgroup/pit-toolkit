import * as fs from "fs"

import { Config } from "./config.js"
import { logger } from "./logger.js"
import { PublisherConfig } from "./teams/config.js"
import { GitConfig } from "./git-tag/config.js"

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

  if (!params.has(Config.PARAM_WORKSPACE)) throw new Error(`The parameter '${ Config.PARAM_WORKSPACE }' is required.`)
  const workspace = params.get(Config.PARAM_WORKSPACE)
  if (!doesDirectoryExist(workspace)) {
    throw new Error(`The is no workspace directory at '${ workspace }'.`)
  }

  const actionsPass = Config.parseActions(params.get(Config.PARAM_TEST_PASS_ACTIONS))
  const actionsFail = Config.parseActions(params.get(Config.PARAM_TEST_FAIL_ACTIONS))

  let exitCode: number = 0
  if (params.has(Config.PARAM_EXIT_CODE)) {
    const existCodeRaw = params.get(Config.PARAM_EXIT_CODE)
    exitCode = parseInt(existCodeRaw)
    if (isNaN(exitCode)) throw new Error(`The exist code must be a simple integer. Current value is: ${existCodeRaw}`)
  }

  const config = new Config(
    actionsPass,
    actionsFail,
    !("false" === params.get(Config.PARAM_DRY_RUN)),
    params.get(Config.PARAM_WORKSPACE),
    exitCode,
    params.get(Config.PARAM_APP_ROOT),
    !params.has(PublisherConfig.PARAM_WEBHOOK) ? undefined : new PublisherConfig(params.get(PublisherConfig.PARAM_WEBHOOK)),
    !params.has(GitConfig.PARAM_GIT_REPOSTIRY_URL) ? undefined : new GitConfig(params.get(GitConfig.PARAM_GIT_REPOSTIRY_URL), params.get(GitConfig.PARAM_GIT_REF))
  )

  return config
}

type ValueReader = (params: Map<string, string>, param: string, isRequired?: boolean, defaultValue?: any) => any | undefined

export const readParameterValue: ValueReader = (params: Map<string, string>, param: string, isRequired?: boolean, defaultValue?: any): any | undefined => {
  const value = params.get(param)
  if (value === undefined || (`${ value }`.trim().length == 0)) {
    const envName = param.replaceAll("--", "").replaceAll("-", "_").toUpperCase()
    logger.debug("readParameterValue(): Cannot find parameter '%s'. Reading environment variable: %s", param, envName)

    const envValue = process.env[envName]
    if (!envValue && !defaultValue && isRequired) throw new Error(`Missing required parameter "${ param }" or env variable: ${ envName }`)
    if (envValue) {
      logger.info("readParameterValue(): Parameter '%s' was loaded from env.%s", param, envName)
      return envValue
    }

    if (!isRequired) {
      logger.info("readParameterValue(): Parameter '%s' is optional, skipping...", param)
      return undefined
    }

    logger.info("readParameterValue(): Cannot find env variable '%s'. Fallback to default value: '%s'", envName, defaultValue)
    return defaultValue
  }

  return value
}

const doesDirectoryExist = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    return true
  } catch (e) {
    logger.warn("isDirectoryExists(): There is no %s or it is not accessible.", filePath, { cause: e })
    return false
  }
}