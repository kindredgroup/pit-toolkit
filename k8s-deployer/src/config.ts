export const DEFAULT_NAMESPACE_TIMEOUT = 300 // in seconds
export const DEFAULT_CLUSTER_URL = "http://localhost"

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
    readonly pitfile: string,
    readonly namespaceTimeoutSeconds: number,
    readonly report: TestReportConfig,
    readonly params: Map<string, string>,
    readonly testStatusPollFrequencyMs: number = 15_000,
    readonly deployCheckFrequencyMs: number = 5_000,
    readonly testTimeoutMs: number = 60_000,
  ) {}
}
