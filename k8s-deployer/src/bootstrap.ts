import { Config, DEFAULT_NAMESPACE_TIMEOUT } from "./config.js"
import { logger } from "./logger.js"

const PARAM_WORKSPACE = "--workspace"
const PARAM_PITFILE = "--pitfile"
const PARAM_NAMESPACE_TIMEOUT = "--namespace-timeout"

const readParams = (): Config => {
  logger.debug("readParams()... \n%s", JSON.stringify(process.argv, null, 2))

  const rawParams = process.argv.slice(2)
  if (rawParams.length %2 !== 0) {
      throw new Error("Invalid parameters format. Expected format is: \"--parameter-name parameter-value\"")
  }
  const params = new Map<string, string>()
  for (let i = 0; i < rawParams.length; i += 2) {
      params.set(rawParams[i], rawParams[i + 1])
  }

  logger.debug("Application started with arguments: \n%s", JSON.stringify(Object.fromEntries(params), null, 2))

  const workspace = params.get(PARAM_WORKSPACE)
  if (!(workspace?.trim().length > 0)) {
      throw new Error(`Missing required parameter: "${ PARAM_WORKSPACE }"`)
  }

  const nsTimeout = params.get(PARAM_NAMESPACE_TIMEOUT)
  let namespaceTimeoutSeconds = DEFAULT_NAMESPACE_TIMEOUT
  if (nsTimeout?.trim().length > 0) {
    namespaceTimeoutSeconds = parseInt(nsTimeout)
    if (isNaN(namespaceTimeoutSeconds)) {
      throw new Error(`Invalid value "${nsTimeout}" for parameter "${ PARAM_NAMESPACE_TIMEOUT }"`)
    }
  }

  return { namespaceTimeoutSeconds, workspace, pitfile: params.get(PARAM_PITFILE), params }
}

export {
  readParams
}