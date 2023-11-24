import * as report from "../report/schema-v1.js"

export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export class StartRequest {
  testSuiteId: string
}

export class StartResponse {
  constructor(readonly sessionId: string, readonly testSuiteId: string) {}
}

export class StatusResponse {
  constructor(
    readonly sessionId: string,
    readonly testSuiteId: string,
    readonly status: TestStatus,
    readonly error?: string
  ) {}
}

export class ReportEnvelope {
  constructor(readonly scenarios: Array<report.TestScenario>) {}
}

export class ReportResponse {
  constructor(
    readonly sessionId: string,
    readonly testSuiteId: string,
    readonly status: TestStatus,
    readonly data?: ReportEnvelope,
    readonly error?: string
  ) {}
}