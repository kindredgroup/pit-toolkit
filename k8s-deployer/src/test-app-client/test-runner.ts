import fetch, { Response } from "node-fetch"
import * as fs from "fs"
import { v4 as uuidv4 } from "uuid"

import { LockManager } from "../locks/lock-manager.js"
import { LockManagerMock } from "../locks/lock-manager-mock.js"
import { DeployedTestSuite, Prefix } from "../model.js"
import { LOG_SEPARATOR_LINE, logger } from "../logger.js"
import * as webapi from "./web-api/schema-v1.js"
import * as ReportSchema from "./report/schema-v1.js"
import { Config } from "../config.js"
import * as Report from "../report/report-service.js"
import * as K8s from "../k8s.js"

export const runAll = async (prefix: Prefix, config: Config, testSuites: Array<DeployedTestSuite>) => {
  for (let deployedSuite of testSuites) {

    logger.info("")
    logger.info("%s Running test suite '%s' %s", LOG_SEPARATOR_LINE, deployedSuite.testSuite.name, LOG_SEPARATOR_LINE)
    logger.info("")
    try {
      const startTime = new Date()
      const reportEnvelope = await runSuite(config, deployedSuite)
      const endTime = new Date()
      const scenarios = reportEnvelope.executedScenarios.map(s => {
        const components = s.componentIds.map(testedComponentId => {
          const deployedComponent = deployedSuite.graphDeployment.components.find(graphNode => testedComponentId === graphNode.component.id)
          return new ReportSchema.Component(deployedComponent.component.id, deployedComponent.commitSha)
        })

        const scenario = new ReportSchema.TestScenario(s.name, s.startTime, s.endTime, s.streams, components, s.metadata)
        return scenario
      })

      const testReport = new ReportSchema.TestReport(
        deployedSuite.testSuite.name || deployedSuite.testSuite.id,
        startTime, endTime, scenarios
      )

      if (config.report.gitRepository) {
        await Report.store(prefix, config, deployedSuite.namespace, deployedSuite.workspace, deployedSuite.testSuite.id, testReport)
      } else {
        logger.info("\n%s", JSON.stringify(testReport, null, 2))
      }

    } catch (e) {
      logger.error("Error executing test: '%s'", deployedSuite.testSuite.id)
      logger.error(e)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
    }
  }
}

const runSuite = async (config: Config, spec: DeployedTestSuite): Promise<webapi.ReportEnvelope> => {
  const testSuiteId = spec.testSuite.id

  // const urlPrefix = `${ config.clusterUrl }/${ spec.namespace }`
  // const urlPrefix = `${ config.clusterUrl }/${ spec.namespace }/services/${ sepc.testSuite.deployment.graph.testApp.id }`

  let lockManager: LockManager | LockManagerMock
  const lockOwner = `${ spec.testSuite.id }-${ uuidv4() }-${ spec.namespace }`
  if (spec.testSuite.lock) {

    if (config.useMockLockManager) {
      logger.info("Test suite: '%s' - preparing to run with mock lock manager", testSuiteId)
      lockManager = LockManagerMock.create(lockOwner)
    } else {
      const url = K8s.makeServiceUrl(
        config.clusterUrl,
        spec.namespace,
        "lock-manager",
        spec.testSuite.id,
        {
          exposedViaProxy: config.servicesAreExposedViaProxy
        }
      )
      lockManager = LockManager.create(lockOwner, url, config.lockManagerApiRetries)
    }

    await lockManager.lock(spec.testSuite.lock)
    logger.info("Test suite: '%s' - all required locks were acquired, starting test...", testSuiteId)
  }

  try {

    const baseUrl = K8s.makeServiceUrl(
      config.clusterUrl,
      spec.namespace,
      spec.testSuite.deployment.graph.testApp.id,
      spec.testSuite.id,
      {
        exposedViaProxy: config.servicesAreExposedViaProxy
      }
    )

    logger.info("API will be accessible at: '%s'", baseUrl)

    const api = {
      start:         { endpoint: `${ baseUrl }/start`,          options: { method: "POST", headers: { "Content-Type": "application/json" }}},
      status:        { endpoint: `${ baseUrl }/status`,         options: { method: "GET", headers: { "Accept": "application/json" }}},
      reports:       { endpoint: `${ baseUrl }/reports`,        options: { method: "GET", headers: { "Accept": "application/json" }}},
      reportsNative: { endpoint: `${ baseUrl }/reports/native`, options: { method: "GET", headers: { "Accept": "application/zip, application/json" }}}
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

    const testTimeoutMs = spec.testSuite.timeoutSeconds * 1_000 || config.testTimeoutMs
    await waitUntilFinish(api, testSuiteId, startResult.sessionId, config.testStatusPollFrequencyMs, testTimeoutMs, 1_000)

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
        await downloadNativeReport(
          spec.workspace,
          api,
          testSuiteId,
          startResult.sessionId,
          `${ testSuiteId }_${ spec.namespace }_native_${ nativeReport.file }`
        )
      }
    }

    return reportResponse.data

  } finally {

    if (lockManager) {
      try {
        await lockManager.release(spec.testSuite.lock)
        logger.info("Test suite: '%s' - all required locks were released by owner '%s'", testSuiteId, lockManager.lockOwner)
      } catch (error) {
        logger.warn("Test suite: '%s' - unexpected error while owner '%s' was releasing locks", testSuiteId, lockManager.lockOwner)
      }
    }

  }
}

const waitUntilFinish = async (
  api: any,
  testSuiteId: string,
  sessionId: string,
  pollFrequencyMs: number,
  testTimeoutMs: number,
  retryTimeoutMs: number
) => {
  const MAX_TECH_FAILURES = 12
  let failuresCount = 0
  const startedAt = new Date()
  while (true) {
    const elapsed = new Date().getTime() - startedAt.getTime()
    logger.info("Test suite: '%s' - waiting for completion using session: '%s' with timeout of %sms. Elapsed: %sms", testSuiteId, sessionId, testTimeoutMs, elapsed)
    if (elapsed >= testTimeoutMs) {
      throw new Error(`Timeout. Giving up after ${ elapsed / 1_000.0 }s while waiting for test to complete: '${ testSuiteId }'`)
    }

    let httpResponse: Response
    try {
      logger.info(`${api.status.endpoint}?sessionId=${sessionId}`)
      httpResponse = await fetch(`${api.status.endpoint}?sessionId=${sessionId}`, api.status.options)
    } catch (e) {
      // allow x number of failed polls and then give up
      if (++failuresCount < MAX_TECH_FAILURES) {
        const sleep = new Promise(resolve => setTimeout(resolve, retryTimeoutMs))
        await sleep
        continue
      }

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

    const sleep = new Promise(resolve => setTimeout(resolve, pollFrequencyMs))
    await sleep
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

const downloadNativeReport = async (workspace: string, api: any, testSuiteId: string, sessionId: string, nativeReportFile: string) => {
  const localPath = `${ workspace }/reports/${ nativeReportFile }`
  logger.info("Test suite: '%s' - downloading native report file '%s' into '%s'", testSuiteId, nativeReportFile, localPath)

  const downloadResp = await fetch(`${ api.reportsNative.endpoint }?sessionId=${ sessionId }`, api.reportsNative.options)
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