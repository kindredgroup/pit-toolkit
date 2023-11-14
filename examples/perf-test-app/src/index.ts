import express, { Express, Request, Response, response } from 'express'
import * as Shell from "child_process"
import * as fs from "fs"
import { open } from "fs/promises"

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"

const DEFAULT_PORT = 62003

const main = async () => {
  const app: Express = express()
  let globalSessionId = 0
  const sessions: Map<number, any> = new Map()

  app.get('/report', async (req: Request, res: Response) => {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(402).send('Invalid parameter "sessionId"')
      return
    }

    sessionId = parseInt(sessionId + "")
    if (!sessions.has(sessionId)) {
      res.status(404).send('No such session')
      return
    }

    const data = sessions.get(sessionId)
    if (data.status !== 'COMPLETED') {
      res.send({ status: data.status })
    } else {
      res.send({ status: data.status, report: data.report })
    }
  })

  app.get('/status', async (req: Request, res: Response) => {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(402).send('Invalid parameter "sessionId"')
      return
    }

    sessionId = parseInt(sessionId + "")
    if (!sessions.has(sessionId)) {
      res.status(404).send('No such session')
      return
    }

    res.send(sessions.get(sessionId))
  })

  app.get('/start', async (req: Request, res: Response) => {
    const sessionId = ++globalSessionId
    const k6ReportFile = "k6-report.json"
    const testSuiteName = req.query["testSuite"]
    const testScriptFile = `k6-tests/${testSuiteName}.js`
    const sessionMeta = { sessionId, test: { testSuiteName, params: { testScriptFile } } }
    sessions.set(sessionId, { status: "PENDING", ...sessionMeta })

    try {
      logger.info("Running test: '%s'", testSuiteName)
      setTimeout(async () => {
        try {
          sessions.get(sessionId).status = 'RUNNING'
          const startedAt = new Date()
          Shell.execSync(`k6 run -q --summary-export ./${k6ReportFile} ${testScriptFile}`)
          const k6Report = fs.readFileSync(k6ReportFile).toString("utf-8")
          const finishedAt = new Date()
          const report = {
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            attachment: JSON.parse(k6Report)
          }
          sessions.set(sessionId, { status: "COMPLETED", report, ...sessionMeta })
        } catch (e) {
          sessions.set(sessionId, { status: "ERROR", error: e.message, ...sessionMeta })
          logger.error("Message: %s", e.message)
          if (e.cause) logger.error(e.cause)
          if (e.stack) logger.error("Stack:\n%s", e.stack)
        }
      }, 1)

      res.send({ testSuiteName, sessionId })

    } catch (e) {
      // sessions.set(sessionId, { status: "ERROR", error: e.message, ...sessionMeta })
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

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })