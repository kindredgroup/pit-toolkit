import { Config, DEFAULT_CLUSTER_URL, DEFAULT_NAMESPACE_TIMEOUT } from "./config.js"
import { logger } from "./logger.js"

// Required
export const PARAM_WORKSPACE = "--workspace"
export const PARAM_PITFILE = "--pitfile"
export const PARAM_PARENT_NS = "--parent-ns"
// Optionals
export const PARAM_NAMESPACE_TIMEOUT = "--namespace-timeout"
export const PARAM_CLUSTER_URL = "--cluster-url"

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

  const parentNs = params.get(PARAM_PARENT_NS)
  if (!(parentNs?.trim().length > 0)) {
      throw new Error(`Missing required parameter: "${ PARAM_PARENT_NS }"`)
  }

  const nsTimeout = params.get(PARAM_NAMESPACE_TIMEOUT)
  let namespaceTimeoutSeconds = DEFAULT_NAMESPACE_TIMEOUT
  if (nsTimeout?.trim().length > 0) {
    namespaceTimeoutSeconds = parseInt(nsTimeout)
    if (isNaN(namespaceTimeoutSeconds)) {
      throw new Error(`Invalid value "${nsTimeout}" for parameter "${ PARAM_NAMESPACE_TIMEOUT }"`)
    }
  }

  const clusterUrl = params.get(PARAM_CLUSTER_URL) || DEFAULT_CLUSTER_URL

  return new Config( clusterUrl, parentNs, workspace, params.get(PARAM_PITFILE), namespaceTimeoutSeconds, params)
}

export {
  readParams
}