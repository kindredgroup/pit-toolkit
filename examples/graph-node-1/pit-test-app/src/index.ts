import fetch from "node-fetch"

import { logger } from "./logger.js"

const PORT = 62001

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
const main = async () => {
  // This is samle Test App, it does not do much of testing, simply calls
  // some HTTP endpoint

  const url = `http://localhost:${PORT}/time`
  const startedAt = new Date()
  const errors = {
    system: 0,
    api: 0
  }

  const stats = { min: -1, max: -1, avg: -1, duration: 0, requests: 0 }
  for (let i = 1; i <= 10000; i++) {
    try {
      const start = new Date()
      const response = await fetch(url)
      if (!response.ok) {
        errors.api++
        continue
      }
      collectStats(stats, start.getTime())

      const _data = await response.json()
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

  logger.info("Finished: \n%s", JSON.stringify(report, null, 2))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })