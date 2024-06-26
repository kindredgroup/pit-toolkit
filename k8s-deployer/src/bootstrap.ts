import { Config,
  DEFAULT_CLUSTER_URL,
  DEFAULT_DEPLOY_CHECK_FREQUENCY,
  DEFAULT_NAMESPACE_TIMEOUT,
  DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE,
  DEFAULT_SUB_NAMESPACE_PREFIX,
  DEFAULT_TEST_RUNNER_APP_PORT,
  DEFAULT_TEST_STATUS_POLL_FREQUENCY,
  DEFAULT_TEST_TIMEOUT,
  SUB_NAMESPACE_GENERATOR_TYPE_COMMITSHA,
  SUB_NAMESPACE_GENERATOR_TYPE_DATE,
  TestReportConfig } from "./config.js"
import { logger } from "./logger.js"

// Required
export const PARAM_COMMIT_SHA = "--commit-sha"
export const PARAM_WORKSPACE = "--workspace"
export const PARAM_PITFILE = "--pitfile"
export const PARAM_PARENT_NS = "--parent-ns"
export const PARAM_SUBNS_PREFIX = "--subns-prefix"
export const PARAM_SUBNS_NAME_GENERATOR_TYPE = "--subns-name-generator-type"
export const PARAM_REPORT_REPOSITORY = "--report-repository"
export const PARAM_REPORT_BRANCH_NAME = "--report-branch-name"
export const PARAM_REPORT_USER_NAME = "--report-user-name"
export const PARAM_REPORT_USER_EMAIL = "--report-user-email"
export const PARAM_TARGET_ENV = "--target-environment"

// Optionals
export const PARAM_NAMESPACE_TIMEOUT = "--namespace-timeout"
export const PARAM_CLUSTER_URL = "--cluster-url"
export const PARAM_LOCK_MANAGER_MOCK = "--lock-manager-mock"
export const PARAM_USE_KUBE_PROXY = "--use-kube-proxy"
export const PARAM_LOCK_MANAGER_API_RETRIES = "--lock-manager-api-retries"
export const PARAM_ENABLE_CLEANUPS = "--enable-cleanups"
export const PARAM_TEST_RUNNER_APP_PORT = "--test-runner-app-port"

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

  const targetEnv = params.get(PARAM_TARGET_ENV)
  if (!(targetEnv?.trim().length > 0)) {
      throw new Error(`Missing required parameter: "${ PARAM_TARGET_ENV }"`)
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

  const useMockLockManager = params.get(PARAM_LOCK_MANAGER_MOCK) === "true"
  const lockManagerApiRetries = params.get(PARAM_LOCK_MANAGER_API_RETRIES) ? parseInt(params.get(PARAM_LOCK_MANAGER_API_RETRIES)) : 3

  let subNsPrefix = params.get(PARAM_SUBNS_PREFIX)
  if (!subNsPrefix) subNsPrefix = DEFAULT_SUB_NAMESPACE_PREFIX

  let subNsGeneratorType = params.get(PARAM_SUBNS_NAME_GENERATOR_TYPE)
  if (subNsGeneratorType) {
    if (subNsGeneratorType !== SUB_NAMESPACE_GENERATOR_TYPE_DATE && subNsGeneratorType !== DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE) {
      throw new Error(`${PARAM_SUBNS_NAME_GENERATOR_TYPE} can be "${SUB_NAMESPACE_GENERATOR_TYPE_DATE}" or "${SUB_NAMESPACE_GENERATOR_TYPE_COMMITSHA}"`)
    }
  } else {
    subNsGeneratorType = DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE
  }

  let testRunnerAppPort = parseInt(params.get(PARAM_TEST_RUNNER_APP_PORT))
  if(isNaN(testRunnerAppPort)){
    testRunnerAppPort = DEFAULT_TEST_RUNNER_APP_PORT
  }

  const useKubeProxy = !params.has(PARAM_USE_KUBE_PROXY) ? true : params.get(PARAM_USE_KUBE_PROXY) === "true"
  const enableCleanups = !params.has(PARAM_ENABLE_CLEANUPS) ? true : params.get(PARAM_ENABLE_CLEANUPS) === "true"

  return new Config(
    commitSha,
    workspace,
    clusterUrl,
    parentNs,
    subNsPrefix,
    subNsGeneratorType,
    params.get(PARAM_PITFILE),
    namespaceTimeoutSeconds,
    new TestReportConfig(
      params.get(PARAM_REPORT_REPOSITORY),
      params.get(PARAM_REPORT_BRANCH_NAME),
      params.get(PARAM_REPORT_USER_NAME),
      params.get(PARAM_REPORT_USER_EMAIL),
    ),
    targetEnv,
    params,
    useKubeProxy,
    useMockLockManager,
    lockManagerApiRetries,
    DEFAULT_TEST_STATUS_POLL_FREQUENCY,
    DEFAULT_DEPLOY_CHECK_FREQUENCY,
    DEFAULT_TEST_TIMEOUT,
    enableCleanups,
    testRunnerAppPort
  )
}

export {
  readParams
}
