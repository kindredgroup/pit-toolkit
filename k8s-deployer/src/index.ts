import { logger } from "./logger.js"
import { readParams } from "./bootstrap.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import * as SuiteHandler from "./test-suite-handler.js"
import { DeployedTestSuite } from "./model.js"
import { validateDependencies } from "./dependency-resolver.js"
import { DependencyValidationError, CyclicDependencyError } from "./errors.js"

const main = async () => {
  logger.info("main()...")

  const config: Config = readParams()
  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...config, params: Object.fromEntries(config.params)}, null, 2))

  const file = await PifFileLoader.loadFromFile(config.pitfile)

  // EARLY VALIDATION: Check all test suites for dependency issues
  logger.info("")
  logger.info("--------------------- Validating Component Dependencies ---------------------")
  logger.info("")

  for (let i = 0; i < file.testSuites.length; i++) {
    const testSuite = file.testSuites[i]

    try {
      validateDependencies(testSuite.deployment.graph.components, testSuite.name)
      logger.info("Test suite '%s' dependencies validated successfully", testSuite.name)
    } catch (error) {
      if (error instanceof DependencyValidationError) {
        // Log dependency validation errors
        logger.error("")
        logger.error("DEPENDENCY VALIDATION FAILED for test suite '%s'", testSuite.name)
        logger.error("")

        error.errors.forEach(err => {
          if (err instanceof CyclicDependencyError) {
            logger.error("CYCLIC DEPENDENCY DETECTED:")
            logger.error("Cycle: %s", err.cyclePath.join(' → '))
            logger.error("This creates an infinite loop and cannot be resolved.")
            logger.error("Please fix the dependency chain in your pitfile.yml")
          } else {
            logger.error("%s", err.message)
          }
        })

        logger.error("")
        logger.error("DEPLOYMENT ABORTED: Fix dependency issues before proceeding")
        logger.error("")
      }

      throw error
    }
  }

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