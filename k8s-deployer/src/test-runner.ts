import fetch, { Response } from "node-fetch"

import { LockManager } from "./lock-manager.js"
import { DeployedTestSuite } from "./model.js"
import { logger } from "./logger.js"
import { ReportResponse, StartRequest, StartResponse, StatusResponse, TestStatus } from "./test-app-api.js"

export const runAll = async (testSuites: Array<DeployedTestSuite>) => {
  for (let suite of testSuites) {
    try {
      await runSuite(suite)
    } catch (e) {
      logger.error("Error executing test: '%s'", suite.testSuite.id)
      logger.error(e)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
    }
  }
}

const runSuite = async (spec: DeployedTestSuite) => {
  const testSuiteId = spec.testSuite.id

  logger.info("Test suite: '%s' - preparing to run", testSuiteId)
  let lockManager = spec.testSuite.lock ? LockManager.create(spec.namespace) : null

  if (lockManager) {
    lockManager.lock(spec.testSuite.id, spec.testSuite.lock)
    logger.info("Test suite: '%s' - all required locks were acquired, starting test...", testSuiteId)
  }

  try {

    const baseUrl = `http://${spec.namespace}.${spec.testSuite.id}`
    const api = {
      start: { endpoint: `${baseUrl}/start`, options: { method: "POST", headers: { "Content-Type": "application/json" } } },
      status: { endpoint: `${baseUrl}/status`, options: { method: "GET", headers: { "Accept": "application/json" } } },
      report: { endpoint: `${baseUrl}/report`, options: { method: "GET", headers: { "Accept": "application/json" }  }}
    }

    const httpResponse = await fetch(
      api.start.endpoint,
      {...api.start.options, body: StartRequest.json(testSuiteId) }
    )

    if (!httpResponse.ok) {
      // TODO: handle http statuses
      throw new Error(httpResponse.statusText)
    }

    const startResult = await httpResponse.json() as StartResponse
    logger.info("Test suite: '%s' - started using session: %s", testSuiteId, startResult.sessionId)

    logger.info("Test suite: '%s' - waiting for completion using session: %s", testSuiteId, startResult.sessionId)
    await waitUntilFinish(api, testSuiteId, startResult.sessionId)

    logger.info("Test suite: '%s' - waiting ended, obtaining report using session: %s", testSuiteId, startResult.sessionId)
    const report = await getReport(api, testSuiteId, startResult.sessionId)
    logger.info("Test suite: '%s' - report downloaded using session: %s", testSuiteId, startResult.sessionId)

  } finally {

    if (lockManager) {
      lockManager.release(spec.testSuite.id, spec.testSuite.lock)
      logger.info("Test suite: '%s' - all required locks were released.", testSuiteId)
    }

  }
}

const waitUntilFinish = async (api: any, testSuiteId: string, sessionId: string) => {
  const MAX_TECH_FAILURES = 12
  let failuresCount = 0
  while (true) {
    const sleep = new Promise(resolve => setTimeout(resolve, 5_000))
    await sleep

    let httpResponse: Response
    try {
      httpResponse = await fetch(`${api.status.endpoint}?sessionId=${sessionId}`, api.status.options)
    } catch (e) {
      // allow x number of failed polls and then give up
      if (++failuresCount < MAX_TECH_FAILURES) continue

      throw new Error(`Unable to fetch status of previously started test: '${testSuiteId}'. Error: '${e.message}'`, { cause: e })
    }

    failuresCount = 0

    if (!httpResponse.ok) {
      // TODO: handle http statuses
      throw new Error(`Unable to fetch status of previously started test: '${testSuiteId}'. Error: '${httpResponse.statusText}'`)
    }

    const statusQueryResult = StatusResponse.create(await httpResponse.json())
    if (statusQueryResult.status === TestStatus.COMPLETED) break

    if (statusQueryResult.status === TestStatus.ERROR) {
      throw new Error(`Test completed with error. Error: '${statusQueryResult.error}'`)
    }
  } // end of poll loop
}

const getReport = async (api: any, testSuiteId: string, sessionId: string): Promise<ReportResponse> => {
  const httpResponse = await fetch(`${api.report.endpoint}?sessionId=${sessionId}`, api.status.options)

  if (!httpResponse.ok) {
    // TODO: handle http statuses
    throw new Error(httpResponse.statusText)
  }

  const reportResponse = await httpResponse.json() as ReportResponse

  return reportResponse
}