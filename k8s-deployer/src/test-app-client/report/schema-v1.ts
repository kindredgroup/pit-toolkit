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
  constructor(readonly name: string, value: Map<number, number>) {
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

export class TestScenario {
  metadata: Object = {}
  constructor(
    readonly id: string,
    readonly startTime: Date,
    readonly endTime: Date,
    readonly streams: Array<TestStream>,
    metadata: Object
  ) {}
}

export class TestReport {
  schemaVersion = SchemaVersion.VERSION_1_0
  metadata: Object = {}

  constructor(
    readonly startTime: Date,
    readonly endTime: Date,
    readonly scenarios: Array<TestScenario>
  ) {}
}