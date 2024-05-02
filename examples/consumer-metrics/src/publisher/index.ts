import { logger } from "../logger.js"

const main = async () => {
  logger.info("main(): Starting producer...")
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    process.exit(1)
  })