import fetch, { HeadersInit, Response } from "node-fetch"
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
import { setupSchemaValidator, getSchemaRef, ApiValidators } from "../schema-validations.js"
import { URLSearchParams } from "url"
import { ApiSchemaValidationError } from "../errors.js"
import Ajv from "ajv"

interface PitApi {
  [K: string]: {
    endpoint: string,
    options: {
      method: "POST" | "GET"
      headers: HeadersInit
    },
    validator?: ApiValidators
  }
}


export const runAll = async (prefix: Prefix, config: Config, testSuites: Array<DeployedTestSuite>) => {
  const schemaValidator = setupSchemaValidator()

  for (let deployedSuite of testSuites) {

    logger.info("")
    logger.info("%s Running test suite '%s' %s", LOG_SEPARATOR_LINE, deployedSuite.testSuite.name, LOG_SEPARATOR_LINE)
    logger.info("")
    try {
      const startTime = new Date()
      const reportEnvelope = await runSuite(config, deployedSuite, schemaValidator)
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

      if (e instanceof ApiSchemaValidationError) {
        logger.error(`url: ${e.url}`)
        if (e.data) logger.error(`data: ${e.data}`)
      }
      //  Finally print the stack
      if (e.stack) logger.error("Stack:\n%s", e.stack)
    }
  }
}

const runSuite = async (config: Config, spec: DeployedTestSuite, schemaValidator: Ajv.default): Promise<webapi.ReportEnvelope> => {

  const testSuiteId = spec.testSuite.id

  // const urlPrefix = `${ config.clusterUrl }/${ spec.namespace }`
  // const urlPrefix = `${ config.clusterUrl }/${ spec.namespace }/services/${ sepc.testSuite.deployment.graph.testApp.id }`

  let lockManager: LockManager | LockManagerMock
  const lockOwner = `${spec.testSuite.id}-${uuidv4()}-${spec.namespace}`
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
        exposedViaProxy: config.servicesAreExposedViaProxy,
        servicePort: config.testRunnerAppPort
      }
    )

    logger.info("API will be accessible at: '%s'", baseUrl)

    const api: PitApi = {
      start: {
        endpoint: `${baseUrl}/start`,
        options: { method: "POST", headers: { "Content-Type": "application/json" } },
        validator: {
          schemaPath: {
            Response: "/components/schemas/StartResponse"
          },
          schemaValidator
        }
      },
      status: {
        endpoint: `${baseUrl}/status`,
        options: { method: "GET", headers: { "Accept": "application/json" } },
        validator: {
          schemaPath: {
            Response: "/components/schemas/StatusResponse"
          },
          schemaValidator
        }
      },
      reports: {
        endpoint: `${baseUrl}/reports`,
        options: { method: "GET", headers: { "Accept": "application/json" } },
        validator: {
          schemaPath: {
            Response: "/components/schemas/ReportResponse"
          },
          schemaValidator
        }

      },
      reportsNative: { endpoint: `${baseUrl}/reports/native`, options: { method: "GET", headers: { "Accept": "application/zip, application/json" } } }
    }

    const httpResponse = await fetch(
      api.start.endpoint,
      { ...api.start.options, body: webapi.StartRequest.json(testSuiteId) }
    )

    if (!httpResponse.ok) {
      // TODO: handle http statuses
      throw new Error(httpResponse.statusText)
    }

    const startResult = await httpResponse.json() as webapi.StartResponse

    const { schemaPath } = api.start.validator
    const isResponseValid = schemaValidator.validate(getSchemaRef(schemaPath.Response), startResult)

    if (!isResponseValid) {
      throw new ApiSchemaValidationError(schemaValidator.errorsText(), api.start.endpoint, JSON.stringify(startResult))

    }
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
          `${testSuiteId}_${spec.namespace}_native_${nativeReport.file}`
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
  api: PitApi,
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
      throw new Error(`Timeout. Giving up after ${elapsed / 1_000.0}s while waiting for test to complete: '${testSuiteId}'`)
    }

    let httpResponse: Response
    const queryParams = new URLSearchParams({
      sessionId
    })
    const statusUrl = `${api.status.endpoint}?${queryParams}`
    try {
      logger.info(statusUrl)
      httpResponse = await fetch(statusUrl, api.status.options)
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

    const reponse = await httpResponse.json()

    const { schemaValidator, schemaPath } = api.status.validator
    const isResponseValid = schemaValidator.validate(getSchemaRef(schemaPath.Response), reponse)

    if (!isResponseValid) {
      throw new ApiSchemaValidationError(schemaValidator.errorsText(), statusUrl, JSON.stringify(reponse))

    }
    const statusQueryResult = webapi.StatusResponse.create(reponse)
    if (statusQueryResult.status === webapi.TestStatus.COMPLETED) break

    if (statusQueryResult.status === webapi.TestStatus.ERROR) {
      throw new Error(`Test completed with error. Error: '${statusQueryResult.error}'`)
    }

    const sleep = new Promise(resolve => setTimeout(resolve, pollFrequencyMs))
    await sleep
  } // end of poll loop
}

const getReport = async (api: PitApi, sessionId: string): Promise<webapi.ReportResponse> => {

  const queryParams = new URLSearchParams({
    sessionId
  })
  const reportUrl = `${api.reports.endpoint}?${queryParams}`
  logger.info(reportUrl)
  const httpResponse = await fetch(reportUrl, api.status.options)

  if (!httpResponse.ok) {
    // TODO: handle http statuses
    throw new Error(httpResponse.statusText)
  }

  const reponse = await httpResponse.json()

  const { schemaValidator, schemaPath } = api.reports.validator
  const isResponseValid = schemaValidator.validate(getSchemaRef(schemaPath.Response), reponse)

  if (!isResponseValid) {
    throw new ApiSchemaValidationError(schemaValidator.errorsText(), reportUrl, JSON.stringify(reponse))

  }

  const result = webapi.ReportResponse.create(reponse)
  if (result.status !== webapi.TestStatus.COMPLETED) {
    const errorText = result.error || "Test did not finish successfully."
    throw new Error(`Error fetching report: '${errorText}'`)
  }
  return result
}

const downloadNativeReport = async (workspace: string, api: any, testSuiteId: string, sessionId: string, nativeReportFile: string) => {
  const localPath = `${workspace}/reports/${nativeReportFile}`
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
