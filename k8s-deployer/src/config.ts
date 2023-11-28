export const DEFAULT_NAMESPACE_TIMEOUT = 300 // in seconds
export const DEFAULT_CLUSTER_URL = "http://localhost"

export class Config {
  constructor(
      // The URL of the test cluster infra
    readonly clusterUrl: string,
    readonly parentNamespace: string,
    readonly workspace: string,
    readonly pitfile: string,
    readonly namespaceTimeoutSeconds: number,
    readonly params: Map<string, string>
  ) {}
}
