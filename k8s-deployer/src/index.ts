import { logger } from "./logger.js"
import { readParams } from "./bootstrap.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import { processTestSuite } from "./test-suite-handler.js"

const main = async () => {
  logger.info("main()...")

  const config: Config = readParams()
  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...config, params: Object.fromEntries(config.params)}, null, 2))

  const file = await PifFileLoader.loadFromFile(config.pitfile)

  for (let i = 0; i < file.testSuites.length; i++) {
    const testSuite = file.testSuites[i]
    await processTestSuite(config, file, `${i + 1}`, testSuite)
  }
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    process.exit(1)
  })