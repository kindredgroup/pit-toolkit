import { Config, DEFAULT_CLUSTER_URL, DEFAULT_NAMESPACE_TIMEOUT, TestReportConfig } from "./config.js"
import { logger } from "./logger.js"

// Required
export const PARAM_COMMIT_SHA = "--commit-sha"
export const PARAM_WORKSPACE = "--workspace"
export const PARAM_PITFILE = "--pitfile"
export const PARAM_PARENT_NS = "--parent-ns"
export const PARAM_REPORT_REPOSITORY = "--report-repository"
export const PARAM_REPORT_BRANCH_NAME = "--report-branch-name"
// Optionals
export const PARAM_NAMESPACE_TIMEOUT = "--namespace-timeout"
export const PARAM_CLUSTER_URL = "--cluster-url"
export const LOCK_MANAGER_MOCK = "--lock-manager-mock"

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

  const commitSha = params.get(PARAM_COMMIT_SHA)
  if (!(commitSha?.trim().length > 0)) {
      throw new Error(`Missing required parameter: "${ PARAM_COMMIT_SHA }"`)
  }

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

  const reportRepo = params.get(PARAM_REPORT_REPOSITORY)
  const reportBranch = params.get(PARAM_REPORT_BRANCH_NAME)

  return new Config(
    commitSha,
    workspace,
    clusterUrl,
    parentNs,
    params.get(PARAM_PITFILE),
    namespaceTimeoutSeconds,
    new TestReportConfig(reportRepo, reportBranch),
    params
  )
}

export {
  readParams
}