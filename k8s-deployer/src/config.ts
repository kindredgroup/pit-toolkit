export const DEFAULT_NAMESPACE_TIMEOUT = 300 // in seconds
export const DEFAULT_CLUSTER_URL = "http://localhost"
export const DEFAULT_SUB_NAMESPACE_PREFIX = "pit"
export const SUB_NAMESPACE_GENERATOR_TYPE_COMMITSHA = "COMMITSHA"
export const SUB_NAMESPACE_GENERATOR_TYPE_DATE = "DATE"
export const DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE = SUB_NAMESPACE_GENERATOR_TYPE_COMMITSHA
export const DEFAULT_TEST_STATUS_POLL_FREQUENCY = 15_000
export const DEFAULT_DEPLOY_CHECK_FREQUENCY = 5_000
export const DEFAULT_TEST_TIMEOUT = 60_000

export class TestReportConfig {
  constructor(
    readonly gitRepository?: string,
    readonly branchName?: string,
    readonly gitUserName?: string,
    readonly gitUserEmail?: string
  ) {}
}

export class Config {
  constructor(
      // The URL of the test cluster infra
    readonly commitSha: string,
    readonly workspace: string,
    readonly clusterUrl: string,
    readonly parentNamespace: string,
    readonly subNamespacePrefix: string,
    readonly subNamespaceGeneratorType: string,
    readonly pitfile: string,
    readonly namespaceTimeoutSeconds: number,
    readonly report: TestReportConfig,
    readonly targetEnv: string,
    readonly params: Map<string, string>,
    readonly servicesAreExposedViaProxy: boolean = true,
    readonly useMockLockManager: boolean = false,
    readonly lockManagerApiRetries: number = 3,
    readonly testStatusPollFrequencyMs: number = DEFAULT_TEST_STATUS_POLL_FREQUENCY,
    readonly deployCheckFrequencyMs: number = DEFAULT_DEPLOY_CHECK_FREQUENCY,
    readonly testTimeoutMs: number = DEFAULT_TEST_TIMEOUT,
    readonly enableCleanups: boolean = true,
  ) {}
}
