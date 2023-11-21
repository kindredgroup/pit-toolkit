import express, { Express, Request, Response, response } from 'express'
import * as Shell from "child_process"
import * as fs from "fs"

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"
import * as report from "./report-schema.js"
import { ReportInfo, ReportResponse, StartRequest, StartResponse, StatusResponse, TestStatus } from './api.js'

const DEFAULT_PORT = 62003

const main = async () => {
  const app: Express = express()
  app.use(express.json())

  let globalSessionId = 0
  const sessions: Map<number, any> = new Map()

  app.get("/report", async (req: Request, res: Response) => {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(422).send("Invalid parameter \"sessionId\"")
      return
    }

    sessionId = parseInt(sessionId + "")
    if (!sessions.has(sessionId)) {
      res.status(422).send("No such session")
      return
    }

    const { status, testSuiteId, report, error } = sessions.get(sessionId)
    if (status !== TestStatus.COMPLETED) {
      res.json(new ReportResponse(sessionId, testSuiteId, status, null, error))
      return
    }

    res.json(new ReportResponse(sessionId, testSuiteId, status, report))
  })

  app.get("/status", async (req: Request, res: Response) => {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(422).send("Invalid parameter \"sessionId\"")
      return
    }

    sessionId = parseInt(sessionId + "")
    if (!sessions.has(sessionId)) {
      res.status(422).send("No such session")
      return
    }

    const { testSuiteId, status } = sessions.get(sessionId)
    res.json(new StatusResponse(sessionId, testSuiteId, status))
  })

  app.post("/start", async (req: Request, res: Response) => {
    const sessionId = ++globalSessionId
    const startRequest = req.body as StartRequest
    const k6ReportFile = `k6-report-${startRequest.testSuiteId}-${sessionId}.json`
    const testScriptFile = `k6-tests/${startRequest.testSuiteId}.js`
    const sessionMeta = { sessionId, testSuiteId: startRequest.testSuiteId, metadata: { testScriptFile, k6ReportFile } }
    sessions.set(sessionId, { status: TestStatus.PENDING, ...sessionMeta })

    try {
      logger.info("Running test: '%s'", startRequest.testSuiteId)
      setTimeout(async () => {
        try {
          sessions.get(sessionId).status = TestStatus.RUNNING
          const startedAt = new Date()
          // TODO externalise this into shell script
          Shell.execSync(`k6 run -q --summary-export ./${k6ReportFile} ${testScriptFile}`)
          const finishedAt = new Date()

          // try {
          //   await fs.promises.access(k6ReportFile, fs.constants.R_OK)
          // } catch (e) {
          //   const error = `Error file is not accessible. Reason: ${e.message}. File: '${process.cwd()}/${k6ReportFile}'`
          //   sessions.set(sessionId, { status: TestStatus.ERROR, error, ...sessionMeta })
          //   logger.error("Message: %s", e.message)
          //   if (e.cause) logger.error(e.cause)
          //   if (e.stack) logger.error("Stack:\n%s", e.stack)
          //   return
          // }

          const k6Report = fs.readFileSync(k6ReportFile).toString("utf-8")
          const pitTestReport = convertK6Report(startRequest.testSuiteId, startedAt, finishedAt, JSON.parse(k6Report))

          const report = {
            startedAt,
            finishedAt,
            report: new ReportInfo(pitTestReport, k6ReportFile)
          }

          sessions.set(sessionId, { status: TestStatus.COMPLETED, report, ...sessionMeta })
        } catch (e) {
          sessions.set(sessionId, { status: TestStatus.ERROR, error: e.message, ...sessionMeta })
          logger.error("Message: %s", e.message)
          if (e.cause) logger.error(e.cause)
          if (e.stack) logger.error("Stack:\n%s", e.stack)
        }
      }, 0)

      res.json(new StartResponse(sessionId.toString(), startRequest.testSuiteId))

    } catch (e) {
      logger.error("Message: %s", e.message)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
      res.sendStatus(500)
    }
  })

  const servicePort = ConfigReader.getParam("--service-port", DEFAULT_PORT)
  app.listen(servicePort, () => {
    logger.info("HTTP server is running at http://localhost:%d", servicePort);
  })
}

const convertK6Report = (id: string, started: Date, finished: Date, k6Report: any): report.TestScenario => {
  const expectedLatency = new report.DistributionMetric(
    "latency",
    new Map([[90.0, 2.0], [95.0, 2.5]])
  )
  const expectedTps = new report.ScalarMetric("throughput", 490.0)

  const actualTps = new report.ScalarMetric(expectedTps.name, k6Report.metrics.http_reqs.rate)

  const data: Map<number, number> = new Map()
  data.set(90.0, k6Report.metrics.http_req_duration["p(90)"])
  data.set(95.0, k6Report.metrics.http_req_duration["p(95)"])

  const actualLatency = new report.DistributionMetric(expectedLatency.name, data)

  const stream: report.TestStream = new report.TestStream(
    id,
    [ expectedLatency, expectedTps ],
    [ actualLatency, actualTps ],
    report.TestOutcomeType.PASS
  )

  return new report.TestScenario(id, started, finished, [ stream ])
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })