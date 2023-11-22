import { Express, Request, Response, response } from 'express'
import * as Shell from "child_process"
import * as fs from "fs"

import { logger } from "../logger.js"
import * as webapi from './schema.js'
import * as k6Adapter from './../report/adapters/k6.js'

export class WebService {
  private globalSessionId: number = 0
  private sessions: Map<number, any> = new Map()

  constructor(readonly app: Express) {
    app.post("/start", async (req: Request, res: Response) => this.postStart(req, res))
    app.get("/status", async (req: Request, res: Response) => this.getStatus(req, res))
    app.get("/reports", async (req: Request, res: Response) => this.getReports(req, res))
    app.get("/reports/native", async (req: Request, res: Response) => this.getNativeReports(req, res))
  }

  private async postStart(req: Request, res: Response) {
    const sessionId = ++this.globalSessionId
    const startRequest = req.body as webapi.StartRequest
    const k6ReportFile = `k6-report-${startRequest.testSuiteId}-${sessionId}.json`
    const testScriptFile = `k6-tests/${startRequest.testSuiteId}.js`
    const sessionMeta = { sessionId, testSuiteId: startRequest.testSuiteId, metadata: { testScriptFile, k6ReportFile } }
    this.sessions.set(sessionId, { status: webapi.TestStatus.PENDING, ...sessionMeta })

    try {
      logger.info("Running test: '%s'", startRequest.testSuiteId)
      setTimeout(async () => {
        try {
          this.sessions.get(sessionId).status = webapi.TestStatus.RUNNING
          const startedAt = new Date()
          logger.info("%s", Shell.execSync(`scripts/k6-test-runner.sh ./${k6ReportFile} ${testScriptFile}`))
          const finishedAt = new Date()

          const k6ReportContent = fs.readFileSync(k6ReportFile).toString("utf-8")
          const pitTestReport = k6Adapter.convertFrom(startRequest.testSuiteId, startedAt, finishedAt, JSON.parse(k6ReportContent))

          const reportEnvelope = new webapi.ReportEnvelope(pitTestReport, webapi.NativeReport.fromFile(`${k6ReportFile}.tgz`))

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

  private async getNativeReports(req: Request, res: Response) {
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

    const { status, reportEnvelope, error } = this.sessions.get(sessionId)
    if (status === webapi.TestStatus.ERROR) {

      const errorText = error || "Report finished with error."
      res.status(500).send(errorText)

    } else if (status === webapi.TestStatus.COMPLETED) {

      if (!reportEnvelope.nativeReport) {
        res.status(404).send()
        return
      }

      res.setHeader("Content-Type", "application/zip")
      res.sendFile(`${process.cwd()}/${reportEnvelope.nativeReport.file}`);

    } else {
      res.status(404).send()
    }
  }
}