export const DEFAULT_NAMESPACE_TIMEOUT = 300 // in seconds
export const DEFAULT_CLUSTER_URL = "http://localhost"
export const DEFAULT_SUB_NAMESPACE_PREFIX = "pit"
export const SUB_NAMESPACE_GENERATOR_TYPE_COMMITSHA = "COMMITSHA"
export const SUB_NAMESPACE_GENERATOR_TYPE_DATE = "DATE"
export const DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE = SUB_NAMESPACE_GENERATOR_TYPE_COMMITSHA

export class TestReportConfig {
  constructor(
    readonly gitRepository?: string,
    readonly branchName?: string
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
    readonly params: Map<string, string>,
    readonly useMockLockManager: boolean,
    readonly servicesAreExposedViaProxy: boolean = true,
    readonly testStatusPollFrequencyMs: number = 15_000,
    readonly deployCheckFrequencyMs: number = 5_000,
    readonly testTimeoutMs: number = 60_000,
  ) {}
}
