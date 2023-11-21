import * as SchemaV1 from "./pitfile/schema-v1.js"

export type Namespace = string

export class DeployedTestSuite {
  namespace: Namespace
  testSuite: SchemaV1.TestSuite
}

export {
  SchemaV1 as Schema
}