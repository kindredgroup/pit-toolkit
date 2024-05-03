import * as hdr from "hdr-histogram-js"

import { logger } from "./utls/logger.js"
import { Pond } from "./utls/pond.js"

const CONCURRENCY = 400

const main = async () => {
  const pool = new Pond(CONCURRENCY)

  const list = new Array()
  const ITEMS_COUNT = 100_000
  for (let i = 1; i <= ITEMS_COUNT; i++) {
    list.push(i)
  }
  list.reverse()

  const processedItems = new Array()
  for (let i = 1; i <= ITEMS_COUNT; i++) {
    pool.submit(async () => {
      const item = list.pop()
      logger.info("%s - %s", i, item)
      processedItems.push(item)
    })
  }

  for (let i = 0; i < processedItems.length; i += 2) {
    const a = processedItems[i]
    const b = processedItems[i + 1]
    if (b - a !== 1) throw Error(`out of order items: $a and $b`)
  }
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })