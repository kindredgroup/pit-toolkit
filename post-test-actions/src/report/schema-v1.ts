import { SchemaVersion } from "./version.js"

export enum MetricType {
  SCALAR = "SCALAR",
  DISTRIBUTION = "DISTRIBUTION",
}

export enum TestOutcomeType {
  PASS = "PASS",
  FAIL = "FAIL"
}

export class ScalarMetric {
  type: MetricType = MetricType.SCALAR
  constructor(readonly name: string, readonly value: number) {}
}

export class DistributionMetric {
  type: MetricType = MetricType.DISTRIBUTION
  value: any
  constructor(readonly name: string, value: Map<string, number>) {
    this.value = Object.fromEntries(value.entries())
  }
}

export type Metric = ScalarMetric | DistributionMetric

export class TestStream {
  constructor(
    readonly name: string,
    readonly requirements: Array<Metric>,
    readonly observations: Array<Metric>,
    readonly outcome: TestOutcomeType
  ) {}
}

export class Component {
  constructor(
    readonly name: string,
    //readonly appVersion: string,
    readonly commitVersion: string
  ) {}
}

export class TestScenario {
  constructor(
    readonly name: string,
    readonly startTime: Date,
    readonly endTime: Date,
    readonly streams: Array<TestStream>,
    readonly components: Array<Component>,
    metadata?: Object
  ) {}
}

export class TestReport {
  schemaVersion = SchemaVersion.VERSION_1_0
  metadata: Object = {}

  constructor(
    readonly name: string,
    readonly startTime: Date,
    readonly endTime: Date,
    readonly scenarios: Array<TestScenario>
  ) {}
}