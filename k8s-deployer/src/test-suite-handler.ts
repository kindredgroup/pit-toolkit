import * as fs from "fs"
import * as Shell from "child_process"

import { LOG_SEPARATOR_LINE, logger } from "./logger.js"
import * as SchemaV1 from "./pitfile/schema-v1.js"
import * as Deployer from "./deployer.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"

const deployLocalTestSuite = async (config: Config, testSuite: SchemaV1.TestSuite, workspace: string, namespace: string) => {
  const components = testSuite.deployment.graph.components
  for (let i = 0; i < components .length; i++) {
    const comonentSpec = components[i]
    logger.info("Deploying graph component (%s of %s) \"%s\"...", i + 1, components.length, comonentSpec.name)
    logger.info("")
    await Deployer.deployComponent(workspace, comonentSpec, namespace)
  }
  logger.info("")

  const testAppSpec = testSuite.deployment.graph.testApp

  logger.info("%s Deploying test app \"%s\" %s", LOG_SEPARATOR_LINE, testAppSpec.name, LOG_SEPARATOR_LINE)
  logger.info("")
  await Deployer.deployComponent(workspace, testAppSpec, namespace)
  logger.info("")
}

const deployRemoteTestSuite = async (config: Config, testSuite: SchemaV1.TestSuite, workspace: string, namespace: string) => {
  // - - - - - - - - - - - - - - - - - - - - -
  // Prepare destination directory name
  let destination = workspace
  while (destination.length > 0 && destination.endsWith("/")) {
    destination.substring(0, destination.length - 1)
  }

  const i = destination.lastIndexOf("/")
  if (i !== -1) {
    destination.substring(i + 1)
  }

  destination = `${destination}/${testSuite.id}`
  // - - - - - - - - - - - - - - - - - - - - -

  Deployer.cloneFromGit(testSuite.name, testSuite.location, destination)
  logger.info("Loading pitfile from remote test suite '%s'", testSuite.name)
  const pitFileName = testSuite.location.pitFile || PifFileLoader.DEFAULT_PITFILE_NAME
  const pitfilePath = `${destination}/${pitFileName}`

  const remotePitFile = await PifFileLoader.loadFromFile(pitfilePath)
  logger.info("\n%s", JSON.stringify(remotePitFile, null, 2))
}

const createWorkspace = async (path: string, suiteName: string) => {
  logger.info("Creating workspace '%s'", path)
  try {
    await fs.promises.access(path, fs.constants.W_OK)
    throw new Error(`Cannot create new workspace '${path}'. Directory or file exists.`)
  } catch (e) {
    // all good, this is expected
  }
  fs.mkdirSync(path)
}

const processTestSuite = async (nr: number, config: Config, testSuite: SchemaV1.TestSuite) => {
  const date = new Date()
  const namespace = `ns${date.getMonth()}${date.getDay()}-${nr}`
  logger.info("Creating namespace for test suite: '%s'\n\n%s",
    namespace,
    Shell.execSync(`k8s-deployer/scripts/k8s-manage-namespace.sh dev create ${namespace}`)
  )
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Deploy everything for this test suite
  logger.info("%s Deploying graph for test suite '%s' %s", LOG_SEPARATOR_LINE, testSuite.name, LOG_SEPARATOR_LINE)
  logger.info("")
  if (testSuite.location.type === SchemaV1.LocationType.Local) {
    const workspace = "."
    await deployLocalTestSuite(config, testSuite, workspace, namespace)
  } else {
    const time = new Date().getHours() + "" + new Date().getMinutes() + "" + new Date().getSeconds() + "" + new Date().getMilliseconds()
    const workspace = `${config.workspace}/testsuite${time}_${testSuite.id}`
    await createWorkspace(workspace, testSuite.name)
    await deployRemoteTestSuite(config, testSuite, workspace, namespace)
  }
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Run tests for this test suite
  // ...

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Undeploy everything for this test suite
  // ...
}

export { processTestSuite }