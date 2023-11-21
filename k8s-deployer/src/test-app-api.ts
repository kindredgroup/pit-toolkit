export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export class StartRequest {
  static json = (testSuiteId: string): string => {
    return JSON.stringify(testSuiteId)
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

export class ReportResponse {
}