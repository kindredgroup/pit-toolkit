import * as report from '../report/schema-v1.js'

export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export class StartRequest {
  static json = (testSuiteId: string): string => {
    return JSON.stringify({ testSuiteId })
  }
}

export class StartResponse {
  sessionId: string
  testSuiteId: string
}

export class StatusResponse {
  constructor(
    readonly sessionId: string,
    readonly testSuiteId: string,
    readonly status: TestStatus,
    readonly error?: string
  ) { }

  static create = (data: any): StatusResponse => {
    return new StatusResponse(data.sessionId, data.testSuiteId, data.status, data.error)
  }
}

export class NativeReport {
  constructor(readonly data?: string, readonly file?: string) {}
}

export class ReportEnvelope {
  constructor(readonly pitScenarioReport: report.TestScenario, readonly nativeReport?: NativeReport) {}
}

export class ReportResponse {
  static create(json: any): ReportResponse {
    return new ReportResponse(
      json.sessionId,
      json.testSuiteId,
      json.status,
      json.data,
      json.error,
    )
  }

  constructor(
    readonly sessionId: string,
    readonly testSuiteId: string,
    readonly status: TestStatus,
    readonly data?: ReportEnvelope,
    readonly error?: string
  ) {}
}