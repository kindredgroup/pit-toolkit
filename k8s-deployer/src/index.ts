import { readParams } from "./bootstrap.js"
import { logger } from "./logger.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"

const main = async () => {
  logger.info("main()...")

  const cfg = readParams()
  const file = await PifFileLoader.loadFromFile(cfg.pitfile)

  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...cfg, params: Object.fromEntries(cfg.params)}, null, 2))
  logger.info("main(), Loaded pitfile: \n%s", JSON.stringify({ lockManager: file.lockManager }, null, 2))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })