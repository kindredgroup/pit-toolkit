import { SchemaVersion } from "./version.js"

export enum LocationType {
  Local = "LOCAL",
  Remote = "REMOTE"
}

export class Location {
  type: LocationType
  path?: string
  gitRepository?: string
  gitRef?: string
  pitFile?: string
}

/**
 * PIT has no knowledge how to check whether deployment went well. When using helm for deployment,
 * even if deployment of chart was successful there could be problems creating pods and getting them
 * into healthy state.
 * App developer is encouraged to implement more thorough checking rather than just "helm -n <NS> list | grep ...".
 */
export class StatusCheck {
  timeoutSeconds?: number
  command: string
}

export class DeployInstructions {
  timeoutSeconds?: number
  command: string
  params?: Array<string>
  statusCheck?: StatusCheck
}

export class LockManager {
  enabled?: boolean
  name: string
  id: string
  deploy: DeployInstructions
  undeploy: DeployInstructions
}

// Test suite
// - - - - - - - - - - - - - - - - - - - - - -
export class Lock {
  timeout: string
  ids: Array<string>
}

export class DeployableComponent {
  name: string
  id: string
  location: Location
  deploy: DeployInstructions
  undeploy: DeployInstructions
}

export class Graph {
  testApp: DeployableComponent
  components: Array<DeployableComponent>
}

export class Deployment {
  graph: Graph
}

export class TestSuite {
  name: string
  id: string
  timeoutSeconds?: number
  location: Location
  lock?: Lock
  deployment: Deployment
  testSuiteIds: Array<string> | undefined
}

// End of Test suite
// - - - - - - - - - - - - - - - - - - - - - -

export class PitFile {
  projectName: string
  version = SchemaVersion.VERSION_1_0

  lockManager: LockManager
  testSuites: Array<TestSuite>
}