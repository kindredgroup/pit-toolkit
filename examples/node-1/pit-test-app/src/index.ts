import fetch from "node-fetch"
import express, { Express, Request, Response, response } from 'express'

import { logger } from "./logger.js"

const DEFAULT_PORT = 62002
const TARGET_SERVICE_URL = "http://localhost"

const getParam = (name: String, defaultValue: string | number): string | number => {
  if (process.argv.length > 2) {
    for (let i = 2; i + 1 < process.argv.length; i++) {
      if (process.argv[i].toLowerCase() !== name) continue
      if (typeof(defaultValue) == 'string') return process.argv[i + 1]

      const numValue = parseInt(process.argv[i + 1])
      if (isNaN(numValue)) {
        logger.warn("Cannot parse parameter '%s' into number. Given value: '%s'. Using default: %s.", name, process.argv[i + 1], defaultValue)
        return defaultValue
      }

      return numValue
    }
  }

  const envName = name.replaceAll("--", "").replaceAll("-", "_").toUpperCase()
  logger.info("Cannot find parameter '%s'. Reading environment varialbe: %s", name, envName)

  const envValue = process.env[envName]
  if (!envValue) return defaultValue

  if (typeof(defaultValue) == 'string') return envValue + ""
  const numValue = parseInt(envValue)
  if (isNaN(numValue)) {
    logger.warn("Cannot parse environemnt variable '%s' into number. Given value: '%s'. Using default: %s.", envName, envValue, defaultValue)
    return defaultValue
  }

  return numValue
}

const collectStats = (stats: any, startedAtMs: number) => {
  const duration = new Date().getTime() - startedAtMs
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
}

const runTests = async (state: any, serviceUrl: string, testName: string, params: any): Promise<any> => {
  const endpoint = `${ serviceUrl }/${ testName }`

  const startedAt = new Date()
  const errors = {
    system: 0,
    api: 0
  }

  const stats = { min: -1, max: -1, avg: -1, duration: 0, requests: 0 }
  const iterationsCount = parseInt(params.iterationsCount)
  for (let i = 1; i <= iterationsCount; i++) {
    state.sessions.get(state.sessionId).status = 'RUNNING'
    try {
      const start = new Date()
      const response = await fetch(endpoint)
      if (!response.ok) {
        errors.api++
        continue
      }
      collectStats(stats, start.getTime())

      const _data = await response.json()
      // logger.info("i: %s, data: %s", i, JSON.stringify(_data))
    } catch (e) {
      logger.error(e)
      errors.system++
    }
  }
  const finishedAt = new Date()
  const report = {
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    errors,
    stats
  }

  return report
}

const main = async () => {
  // This is samle Test App, it does not do much of testing, simply calls
  // some HTTP endpoint

  const targetServiceUrl = getParam("--target-service-url", TARGET_SERVICE_URL)
  logger.info("Test app will be connecting to: %s", targetServiceUrl)

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
    const testSuiteName = req.query["testSuite"]
    const iterationsCount = req.query["iterationsCount"]
    const sessionMeta = { sessionId, test: { testSuiteName, params: { iterationsCount } } }

    try {
      sessions.set(sessionId, { status: 'PENDING', ...sessionMeta })

      logger.info("Running test: '%s', iterationsCount: %s", testSuiteName, iterationsCount)

      const report = await runTests({ sessions, sessionId }, targetServiceUrl as string, testSuiteName as string, { iterationsCount })
      sessions.set(sessionId, { status: 'COMPLETED', report, ...sessionMeta })
      res.send({
        testSuiteName,
        iterationsCount,
        report,
        sessionId
      })
    } catch (e) {
      sessions.set(sessionId, { status: 'ERROR', error: e.message, ...sessionMeta })
      logger.error("Message: %s", e.message)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
      res.sendStatus(500)
    }
  })

  const servicePort = getParam("--service-port", DEFAULT_PORT)
  app.listen(servicePort, () => {
    logger.info("HTTP server is running at http://localhost:%d", servicePort);
  })

  //logger.info("Finished: \n%s", JSON.stringify(report, null, 2))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })