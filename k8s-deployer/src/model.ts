import * as SchemaV1 from "./pitfile/schema-v1.js"

export type Prefix = string
export type Namespace = string
export type CommitSha = string

export class DeployedTestSuite {
  constructor (
    readonly workspace: string,
    readonly namespace: Namespace,
    readonly testSuite: SchemaV1.TestSuite,
    readonly graphDeployment: GraphDeploymentResult,
    ) {}
}

export class DeployedComponent {
  constructor (
    readonly commitSha: CommitSha,
    readonly component: SchemaV1.DeployableComponent
    ) {}
}

export class GraphDeploymentResult {

  constructor(
    readonly components: Array<DeployedComponent>,
    readonly testApp: DeployedComponent
  ) {}
}

export {
  SchemaV1 as Schema
}