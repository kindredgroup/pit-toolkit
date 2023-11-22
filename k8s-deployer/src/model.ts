import * as SchemaV1 from "./pitfile/schema-v1.js"

export type Namespace = string

export class DeployedTestSuite {
  constructor (
    readonly namespace: Namespace,
    readonly testSuite: SchemaV1.TestSuite,
    readonly workspace: string) {}
}

export {
  SchemaV1 as Schema
}