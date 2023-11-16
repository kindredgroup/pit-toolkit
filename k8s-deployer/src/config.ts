export const DEFAULT_NAMESPACE_TIMEOUT = 300 // in seconds

export class Config {
  workspace: string
  pitfile: string
  namespaceTimeoutSeconds: number
  params: Map<string, string>
}
