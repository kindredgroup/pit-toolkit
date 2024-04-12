import * as hdr from "hdr-histogram-js"

import { logger } from "./utls/logger.js"
import { Pond } from "./utls/pond.js"
import { generateAtRate } from "./utls/rate-manager.js"
import * as business from "./business-logic.js"

const CONCURRENCY = 400

declare type ItemType = string

const main = async () => {
  const rateTps = parseInt(process.argv[2])
  const durationSeconds = parseInt(process.argv[3])
  const slowProcessingDelay = parseInt(process.argv[4])

  logger.info("Load generator will run for %ss at the rate of %stps. The approx stop time is %s", durationSeconds, rateTps, new Date(new Date().getTime() + durationSeconds * 1000))

  const pool = new Pond(CONCURRENCY)
  const histBusinessMetrics = hdr.build();
  const histBusinessMetricsTps = hdr.build();
  const histLoadRate = hdr.build();
  for await (const task of generateAtRate(rateTps, durationSeconds, fnGenerateNewItem)) {
    pool.submit(async () => {
      histLoadRate.recordValue(Date.now())
      const startedAt = Date.now()
      await business.logItemAndSleep(Math.random() * (slowProcessingDelay - 1) + 1, task)
      histBusinessMetrics.recordValue(Date.now() - startedAt)
      histBusinessMetricsTps.recordValue(Date.now())
    })
  }

  setTimeout(async () => {
    while (histBusinessMetricsTps.totalCount < rateTps * durationSeconds) {
      logger.info("progress ... processed: %s of %s", histBusinessMetricsTps.totalCount, rateTps * durationSeconds)
      await (new Promise(resolve => setTimeout(resolve, 1000)))
    }

    logger.info("progress ... processed: %s of %s", histBusinessMetricsTps.totalCount, rateTps * durationSeconds)

    await printReport("Load Generator", histLoadRate, rateTps, durationSeconds)
    await printReport("Buisness Service Metrics", histBusinessMetricsTps, rateTps, durationSeconds)

    logger.info("\n\n")
    logger.info(`

        Buisness Service Metrics (details):
        --------------------------------------------
        count: %s
        min  : %s (ms)
        max  : %s (ms)

        p50  : %s (ms)
        p75  : %s (ms)
        p90  : %s (ms)
        p95  : %s (ms)
        p100 : %s (ms)

      `,
      histBusinessMetrics.totalCount,
      histBusinessMetrics.minNonZeroValue,
      histBusinessMetrics.maxValue,
      histBusinessMetrics.getValueAtPercentile(50),
      histBusinessMetrics.getValueAtPercentile(75),
      histBusinessMetrics.getValueAtPercentile(90),
      histBusinessMetrics.getValueAtPercentile(95),
      histBusinessMetrics.getValueAtPercentile(100)
    )
  })
}

const fnGenerateNewItem = (i: string): ItemType => {
  const date = new Date().toISOString()
  const time = date.substring(date.indexOf("T") + 1).replace("Z", "")
  return `item-${ i } [${ time }]`
}

const printReport = async (name: string, hist: hdr.Histogram, rateTps: number, durationSeconds: number) => {
  // await until done
  const elapsedMs = (hist.maxValue - hist.minNonZeroValue)
  logger.info(`

    %s Metrics:
    --------------------------------------------
    count         : %s
    effective rate: %s (tps)
    duration      : %s (sec)`,

    name,
    hist.totalCount,
    Math.round(hist.totalCount / elapsedMs * 1000 * 100) / 100,
    Math.round(elapsedMs / 10) / 100
  )
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })