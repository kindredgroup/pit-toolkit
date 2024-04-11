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
  const histLoadRate = hdr.build();
  for await (const task of generateAtRate(rateTps, durationSeconds, fnGenerateNewItem)) {
    pool.submit(async () => {
      histLoadRate.recordValue(Date.now())
      await business.logItemAndSleep(slowProcessingDelay, task)
    })
  }

  // await until done
  setTimeout(async () => {
    while (histLoadRate.totalCount < rateTps * durationSeconds) {
      logger.info("Processed: %s", histLoadRate.totalCount)
      await (new Promise(resolve => setTimeout(resolve, 1000)))
    }
    const elapsedMs = (histLoadRate.maxValue - histLoadRate.minNonZeroValue)
    logger.info(`
      Load Generator Metrics:
      --------------------------------------------
      count         : %s
      effective rate: %s (tps)
      duration      : %s (sec)`,
      histLoadRate.totalCount,
      Math.round(histLoadRate.totalCount / elapsedMs * 1000 * 100) / 100,
      Math.round(elapsedMs / 10) / 100
    )
  }, 0 )

}

const fnGenerateNewItem = (i: string): ItemType => {
  const date = new Date().toISOString()
  const time = date.substring(date.indexOf("T") + 1).replace("Z", "")
  return `item-${ i } [${ time }]`
}


main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })