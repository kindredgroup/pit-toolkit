export enum PitFileSchemaVersion {
  VERSION_1_0 = "1.0"
}

// Trigger
// - - - - - - - - - - - - - - - - - - - - - -
export class Filter {
  expressions: [RegExp]
}

export class Trigger {
  description?: string
  name: string
  filter: Filter
}
// End of trigger
// - - - - - - - - - - - - - - - - - - - - - -

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
  statusCheck?: StatusCheck
}

export class LockManager {
  enabled?: boolean
  name: string
  id: string
  deploy: DeployInstructions
}

// Test suite
// - - - - - - - - - - - - - - - - - - - - - -
export class Lock {
  timeout: string
  ids: [string]
}

export class DeployableComponent {
  name: string
  id: string
  location: Location
  deploy: DeployInstructions
}

export class Graph {
  testApp: DeployableComponent
  components: [DeployableComponent]
}

export class Deployment {
  graph: Graph
}

export class TestSuite {
  name: string
  id: string
  location: Location
  lock?: Lock
  trigger?: Trigger
  deployment: Deployment
  lockManagerPort?: number
  testSuiteIds: [string] | undefined
}

// End of Test suite
// - - - - - - - - - - - - - - - - - - - - - -

export class PitFile {
  projectName: string
  version: PitFileSchemaVersion = PitFileSchemaVersion.VERSION_1_0

  trigger?: Trigger
  lockManager: LockManager
  testSuites: [TestSuite]
}