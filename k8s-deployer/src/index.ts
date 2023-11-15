import { LOG_SEPARATOR_LINE, logger } from "./logger.js"
import { readParams } from "./bootstrap.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import * as Deployer from "./deployer.js"
import { processTestSuite } from "./test-suite-handler.js"

const main = async () => {
  logger.info("main()...")

  const config: Config = readParams()
  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...config, params: Object.fromEntries(config.params)}, null, 2))

  const file = await PifFileLoader.loadFromFile(config.pitfile)

  if (file.lockManager.enabled) {
    logger.info("%s Deploying 'Lock Manager' application %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
    logger.info("")
    await Deployer.deployLockManager()
    logger.info("")
  } else {
    logger.info("%s The 'Lock Manager' will not be deployed %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
    logger.info("")
  }

  for (let i = 0; i < file.testSuites.length; i++) {
    const testSuite = file.testSuites[i]
    await processTestSuite(i + 1, config, testSuite)
  }

  // logger.info("main(), Loaded pitfile: \n%s", JSON.stringify({ lockManager: file.lockManager }, null, 2))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    process.exit(1)
  })