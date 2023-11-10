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
  type: LocationType = LocationType.Local
  path?: string
  gitRepository?: string
  gitRef?: string
}

export class LockManager {
  name: string
  id: string
  description: string
  location: Location
  deploymentLauncher: string
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
  deploymentLauncher: string
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