import { logger } from "./logger.js"
import { readParams } from "./bootstrap.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import * as SuiteHandler from "./test-suite-handler.js"
import { DeployedTestSuite } from "./model.js"

const main = async () => {
  logger.info("main()...")

  const config: Config = readParams()
  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...config, params: Object.fromEntries(config.params)}, null, 2))

  const file = await PifFileLoader.loadFromFile(config.pitfile)

  const artefacts = new Array<Array<DeployedTestSuite>>()
  for (let i = 0; i < file.testSuites.length; i++) {
    const testSuite = file.testSuites[i]

    const prefix = `${ SuiteHandler.generatePrefix(config.targetEnv) }_${ (i+1) }`
    const deployments = await SuiteHandler.processTestSuite(prefix, config, file, `${i + 1}`, testSuite)
    artefacts.push(deployments)
  }

  logger.info("")
  logger.info("--------------------- Cleaning up --------------------- ")
  logger.info("")
  if (config.enableCleanups) {
    for (let deployments of artefacts) {
      await SuiteHandler.undeployAll(config, file, deployments)
    }
  } else {
    logger.info("The cleanups are intentionally disabled.")
  }

  logger.info("")
  logger.info("DONE")
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    process.exit(1)
  })