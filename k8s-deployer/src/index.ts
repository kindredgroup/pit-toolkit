import { readParams } from "./bootstrap"
import { logger } from "./logger"
import { readPitFile } from "./pitfile"

const main = async () => {
  logger.info("main()...")

  const cfg = readParams()
  const file = await readPitFile(cfg.pitfile)

  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...cfg, params: Object.fromEntries(cfg.params)}, null, 2))
  logger.info("main(), Loaded pitfile: \n%s", JSON.stringify({ lockManager: file.lockManager }, null, 2))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })