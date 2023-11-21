import * as report from "./report-schema.js"

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

export class ReportInfo {
  constructor(readonly pitTestReport: report.TestScenario, readonly  nativeReport?: any) {}
}

export class ReportResponse {
  constructor(
    readonly sessionId: string,
    readonly testSuiteId: string,
    readonly status: TestStatus,
    readonly report?: ReportInfo,
    readonly error?: string
  ) {}
}