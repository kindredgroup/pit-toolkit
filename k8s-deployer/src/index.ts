import { readParams } from "./bootstrap.js"
import { logger } from "./logger.js"

import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import * as Deployer from "./deployer.js"

const LOG_SEPARATOR_LINE = "* * * * * * * * * * * * *"

const main = async () => {
  logger.info("main()...")

  const cfg = readParams()
  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...cfg, params: Object.fromEntries(cfg.params)}, null, 2))

  const file = await PifFileLoader.loadFromFile(cfg.pitfile)

  logger.info("%s Deploying \"%s\" application %s", LOG_SEPARATOR_LINE, file.lockManager.name, LOG_SEPARATOR_LINE)
  logger.info("")
  await Deployer.deployLockManager(file.lockManager)
  logger.info("")

  for (const testSuite of file.testSuites) {
    logger.info("%s Deploying graph for test suite \"%s\" %s", LOG_SEPARATOR_LINE, testSuite.name, LOG_SEPARATOR_LINE)
    logger.info("")
    const components = testSuite.deployment.graph.components
    for (let i = 0; i < components .length; i++) {
      const comonentSpec = components[i]
      logger.info("Deploying graph component (%s of %s) \"%s\"...", i + 1, components.length, comonentSpec.name)
      logger.info("")
      await Deployer.deployComponent(comonentSpec)
    }
    logger.info("")

    const testAppSpec = testSuite.deployment.graph.testApp

    logger.info("%s Deploying test app \"%s\" %s", LOG_SEPARATOR_LINE, testAppSpec.name, LOG_SEPARATOR_LINE)
    logger.info("")
    await Deployer.deployComponent(testAppSpec)
    logger.info("")
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