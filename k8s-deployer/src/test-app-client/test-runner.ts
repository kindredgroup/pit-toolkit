import fetch, { Response } from "node-fetch"
import * as fs from "fs"

import { LockManager } from "../locks/lock-manager.js"
import { DeployedTestSuite } from "../model.js"
import { logger } from "../logger.js"
import * as webapi from "./web-api/schema-v1.js"
import * as report from "./report/schema-v1.js"

export const runAll = async (testSuites: Array<DeployedTestSuite>) => {
  for (let suite of testSuites) {
    try {
      const startTime = new Date()
      const reportEnvelope = await runSuite(suite)
      const endTime = new Date()
      const scenarios = reportEnvelope.executedScenarios.map(s => {
        const components = s.componentIds.map(testedComponentId => {
          const deployedComponent = suite.graphDeployment.components.find(graphNode => testedComponentId === graphNode.component.id)
          return new report.Component(deployedComponent.component.id, deployedComponent.commitSha)
        })

        const scenario = new report.TestScenario(s.name, s.startTime, s.endTime, s.streams, components, s.metadata)
        return scenario
      })
      const testReport = new report.TestReport(startTime, endTime, scenarios)

      // TODO: do something with report, otherwise just log it
      logger.info("\n%s", JSON.stringify(testReport, null, 2))

    } catch (e) {
      logger.error("Error executing test: '%s'", suite.testSuite.id)
      logger.error(e)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
    }
  }
}

const runSuite = async (spec: DeployedTestSuite): Promise<webapi.ReportEnvelope> => {
  const testSuiteId = spec.testSuite.id

  logger.info("Test suite: '%s' - preparing to run", testSuiteId)
  let lockManager = spec.testSuite.lock ? LockManager.create(spec.namespace) : null

  if (lockManager) {
    lockManager.lock(spec.testSuite.id, spec.testSuite.lock)
    logger.info("Test suite: '%s' - all required locks were acquired, starting test...", testSuiteId)
  }

  try {

    // TODO externalise host name into parameter or env variable
    const baseUrl = `http://localhost/${spec.namespace}.${spec.testSuite.id}`
    const api = {
      start:         { endpoint: `${baseUrl}/start`,          options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      status:        { endpoint: `${baseUrl}/status`,         options: { method: "GET", headers: { "Accept": "application/json" }}},
      reports:       { endpoint: `${baseUrl}/reports`,        options: { method: "GET", headers: { "Accept": "application/json" }}},
      reportsNative: { endpoint: `${baseUrl}/reports/native`, options: { method: "GET", headers: { "Accept": "application/zip, application/json" }}}
    }

    const httpResponse = await fetch(
      api.start.endpoint,
      {...api.start.options, body: webapi.StartRequest.json(testSuiteId) }
    )

    if (!httpResponse.ok) {
      // TODO: handle http statuses
      throw new Error(httpResponse.statusText)
    }

    const startResult = await httpResponse.json() as webapi.StartResponse
    logger.info("Test suite: '%s' - started using session: %s", testSuiteId, startResult.sessionId)

    logger.info("Test suite: '%s' - waiting for completion using session: %s", testSuiteId, startResult.sessionId)
    await waitUntilFinish(api, testSuiteId, startResult.sessionId)

    logger.info("Test suite: '%s' - waiting ended, obtaining report using session: %s", testSuiteId, startResult.sessionId)
    const reportResponse = await getReport(api, startResult.sessionId)

    logger.info("Test suite: '%s' - report fetched using session: %s", testSuiteId, startResult.sessionId)

    if (reportResponse.data?.nativeReport) {
      const nativeReport = reportResponse.data?.nativeReport
      logger.info("Test suite: '%s' - test results contain native report", testSuiteId)

      if (nativeReport.data) {

        logger.info("%s", JSON.stringify(nativeReport?.data, null, 2))

      } else if (nativeReport?.file) {
        for (let scenario of reportResponse.data.executedScenarios) {
          scenario.metadata = {
            nativeReport: { file: nativeReport.file }
          }
        }
        await downloadNativeReport(api, testSuiteId, startResult.sessionId, spec.workspace, nativeReport.file)

      }
    }

    return reportResponse.data

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
      logger.info(`${api.status.endpoint}?sessionId=${sessionId}`)
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

    const statusQueryResult = webapi.StatusResponse.create(await httpResponse.json())
    if (statusQueryResult.status === webapi.TestStatus.COMPLETED) break

    if (statusQueryResult.status === webapi.TestStatus.ERROR) {
      throw new Error(`Test completed with error. Error: '${statusQueryResult.error}'`)
    }
  } // end of poll loop
}

const getReport = async (api: any, sessionId: string): Promise<webapi.ReportResponse> => {
  logger.info(`${api.reports.endpoint}?sessionId=${sessionId}`)
  const httpResponse = await fetch(`${api.reports.endpoint}?sessionId=${sessionId}`, api.status.options)

  if (!httpResponse.ok) {
    // TODO: handle http statuses
    throw new Error(httpResponse.statusText)
  }

  const result = webapi.ReportResponse.create(await httpResponse.json())
  if (result.status !== webapi.TestStatus.COMPLETED) {
    const errorText = result.error || "Test did not finish successfully."
    throw new Error(`Error fetching report: '${ errorText }'`)
  }
  return result
}

const downloadNativeReport = async (api: any, testSuiteId: string, sessionId: string, workspace: string, nativeReportFile: string) => {
  const localPath = `${workspace}/${nativeReportFile}`
  logger.info("Test suite: '%s' - downloading native report file '%s' into '%s'", testSuiteId, nativeReportFile, localPath)

  const downloadResp = await fetch(`${api.reportsNative.endpoint}?sessionId=${sessionId}`, api.reportsNative.options)
  if (!downloadResp.ok) {
    logger.error("Error downloading native report for '%s'. Error: %s", testSuiteId, downloadResp.statusText)
    return
  }

  const fileStream = fs.createWriteStream(localPath)
  try {
    await new Promise((resolve, reject) => {
      downloadResp.body.pipe(fileStream);
      downloadResp.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    logger.info("Test suite: '%s' - Native report is downloaded to '%s'", testSuiteId, localPath)

  } catch (e) {
    logger.error("Error saving native report for '%s' into '%s'. Error: %s", testSuiteId, localPath, e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  }
}