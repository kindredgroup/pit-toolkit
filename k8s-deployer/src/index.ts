import { logger } from "./logger.js"
import { readParams } from "./bootstrap.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import * as SuiteHandler from "./test-suite-handler.js"
import { DeployedTestSuite, Prefix } from "./model.js"

const generatePrefix = (): Prefix => {
  const date = new Date()
  const pad = (v: string | number, len: number = 2): string => {
    let result = `${ v }`
    while (result.length < len) result = `0${ result }`
    return result
  }
  let prefix = "pit"
  prefix = `${ prefix }${ pad(date.getUTCFullYear()) }`
  prefix = `${ prefix }${ pad(date.getUTCMonth()+1) }`
  prefix = `${ prefix }${ pad(date.getUTCDay()) }`
  prefix = `${ prefix }${ pad(date.getUTCHours()) }`
  prefix = `${ prefix }${ pad(date.getUTCMinutes()) }`
  prefix = `${ prefix }${ pad(date.getUTCSeconds()) }`
  prefix = `${ prefix }${ pad(date.getUTCMilliseconds(), 3) }`

  return prefix
}

const main = async () => {
  logger.info("main()...")

  const config: Config = readParams()
  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...config, params: Object.fromEntries(config.params)}, null, 2))

  const file = await PifFileLoader.loadFromFile(config.pitfile)

  const artefacts = new Array<Array<DeployedTestSuite>>()
  for (let i = 0; i < file.testSuites.length; i++) {
    const testSuite = file.testSuites[i]

    const prefix = `${ generatePrefix() }_${ (i+1) }`
    const deployments = await SuiteHandler.processTestSuite(prefix, config, file, `${i + 1}`, testSuite)
    artefacts.push(deployments)
  }

  logger.info("")
  logger.info("--------------------- Cleaning up --------------------- ")
  logger.info("")
  for (let deployments of artefacts) {
    await SuiteHandler.undeployAll(config, file, deployments)
  }

  logger.info("DONE")
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    process.exit(1)
  })