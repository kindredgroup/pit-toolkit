import { Express, Request, Response, response } from 'express'
import fetch from "node-fetch"

import { logger } from "../logger.js"
import * as webapi from './schema-v1.js'
import * as report from '../report/schema-v1.js'

export class WebService {
  private globalSessionId: number = 0
  private sessions: Map<number, any> = new Map()

  constructor(readonly app: Express, readonly targetServiceUrl: string) {
    app.post("/start", async (req: Request, res: Response) => this.postStart(req, res))
    app.get("/status", async (req: Request, res: Response) => this.getStatus(req, res))
    app.get("/reports", async (req: Request, res: Response) => this.getReports(req, res))
  }

  private async postStart(req: Request, res: Response) {
    const sessionId = ++this.globalSessionId
    const startRequest = req.body as webapi.StartRequest

    const sessionMeta = { sessionId, testSuiteId: startRequest.testSuiteId }
    this.sessions.set(sessionId, { status: webapi.TestStatus.PENDING, ...sessionMeta })

    try {
      logger.info("Running test: '%s'", startRequest.testSuiteId)
      setTimeout(async () => {
        try {
          const scenarios = await this.runTests(
            startRequest.testSuiteId,
            sessionId,
          )
          const reportEnvelope = new webapi.ReportEnvelope(scenarios)
          this.sessions.set(sessionId, { status: webapi.TestStatus.COMPLETED, reportEnvelope, ...sessionMeta })
        } catch (e) {
          this.sessions.set(sessionId, { status: webapi.TestStatus.ERROR, error: e.message, ...sessionMeta })
          logger.error("Message: %s", e.message)
          if (e.cause) logger.error(e.cause)
          if (e.stack) logger.error("Stack:\n%s", e.stack)
        }
      }, 0)

      res.json(new webapi.StartResponse(sessionId.toString(), startRequest.testSuiteId))

    } catch (e) {
      logger.error("Message: %s", e.message)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
      res.sendStatus(500)
    }
  }

  private async getStatus(req: Request, res: Response) {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(422).send("Invalid parameter \"sessionId\"")
      return
    }

    sessionId = parseInt(sessionId + "")
    if (!this.sessions.has(sessionId)) {
      res.status(422).send("No such session")
      return
    }

    const { testSuiteId, status } = this.sessions.get(sessionId)
    res.json(new webapi.StatusResponse(sessionId, testSuiteId, status))
  }

  private async getReports(req: Request, res: Response) {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(422).send("Invalid parameter \"sessionId\"")
      return
    }

    sessionId = parseInt(sessionId + "")
    if (!this.sessions.has(sessionId)) {
      res.status(422).send("No such session")
      return
    }

    const { status, testSuiteId, reportEnvelope, error } = this.sessions.get(sessionId)
    if (status !== webapi.TestStatus.COMPLETED) {
      res.json(new webapi.ReportResponse(sessionId, testSuiteId, status, null, error))
      return
    }

    res.json(new webapi.ReportResponse(sessionId, testSuiteId, status, reportEnvelope))
  }

  private async runTests(testSuiteId: string, sessionId: number): Promise<Array<webapi.ExecutedTestScenario>> {
    this.sessions.get(sessionId).status = webapi.TestStatus.RUNNING

    const specs = [
      {
        iterations: 100,
        name: "GET /time x 100",
        requirements: [ new report.ScalarMetric("throughput", 600) ]
      },
      {
        iterations: 10000,
        name: "GET /time x 10000",
        requirements: [ new report.ScalarMetric("throughput", 1000) ]
      }
    ]

    const scenarios = new Array<webapi.ExecutedTestScenario>()

    for (let spec of specs) {
      const startedAt = new Date()
      const stats = await this.runTestScenario(testSuiteId, spec.iterations)
      const finishedAt = new Date()

      const elapsedMs = finishedAt.getTime() - startedAt.getTime()
      const rate = stats.requests / (elapsedMs / 1_000.0)
      const outcome = rate >= spec.requirements[0].value ? report.TestOutcomeType.PASS : report.TestOutcomeType.FAIL
      const throughput = new report.ScalarMetric("throughput", rate)
      const stream = new report.TestStream("default", spec.requirements, [ throughput ], outcome)
      const scenario = new webapi.ExecutedTestScenario(spec.name, startedAt, finishedAt, [ stream ], [ "node-1" ])
      scenarios.push(scenario)
    }

    return scenarios
  }

  private async runTestScenario(_testSuiteId: string, iterationsCount: number): Promise<any> {
    const endpoint = `${ this.targetServiceUrl }/time`
    const stats = { min: -1, max: -1, avg: -1, duration: 0, requests: 0 }
    const errors = { system: 0, api: 0 }

    for (let i = 1; i <= iterationsCount; i++) {
      try {
        const start = new Date()
        const response = await fetch(endpoint)
        if (!response.ok) {
          errors.api++
          continue
        }

        const duration = new Date().getTime() - start.getTime()
        if (stats.min == -1) {
          stats.min = duration
          stats.max = duration
          stats.avg = duration
          stats.requests = 1
          stats.duration = duration
        } else {
          stats.requests++
          stats.min = Math.min(stats.min, duration)
          stats.max = Math.max(stats.max, duration)
          stats.duration += duration
          stats.avg = stats.duration / stats.requests
        }

      } catch (e) {
        logger.error(e)
        errors.system++
      }
    }

    return stats
  }
}