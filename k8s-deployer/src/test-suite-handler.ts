import * as fs from "fs"

import { LOG_SEPARATOR_LINE, logger } from "./logger.js"
import * as SchemaV1 from "./pitfile/schema-v1.js"
import * as Deployer from "./deployer.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import * as k8s from "./k8s.js"

const deployGraph = async (graph: SchemaV1.Graph, workspace: string, namespace: string, testAppDirForRemoteTestSuite?: string) => {
  for (let i = 0; i < graph.components.length; i++) {
    const comonentSpec = graph.components[i]
    logger.info("Deploying graph component (%s of %s) \"%s\"...", i + 1, graph.components.length, comonentSpec.name)
    logger.info("")
    await Deployer.deployComponent(workspace, comonentSpec, namespace)
  }
  logger.info("")

  logger.info("%s Deploying test app \"%s\" %s", LOG_SEPARATOR_LINE, graph.testApp.name, LOG_SEPARATOR_LINE)
  logger.info("")

  if (testAppDirForRemoteTestSuite) {
    // When suite is remote its pitfile is sitting within test app itself.
    // We just downloaded pitfile from remote location into workspace
    logger.info(
      "Overwriting 'graph.testApp.location.path' to '%s' for testApp: '%s'",
      testAppDirForRemoteTestSuite, graph.testApp.name
    )
    graph.testApp.location.path = testAppDirForRemoteTestSuite
  }
  await Deployer.deployComponent(workspace, graph.testApp, namespace)
  logger.info("")
}

const downloadRemotePitFile = async (testSuite: SchemaV1.TestSuite, destination: string): Promise<SchemaV1.PitFile> => {
  Deployer.cloneFromGit(testSuite.name, testSuite.location, destination)
  logger.info("Loading pitfile from remote test suite '%s'", testSuite.name)
  const pitFileName = testSuite.location.pitFile || PifFileLoader.DEFAULT_PITFILE_NAME
  // TODO how to add test app directory name here??
  const pitfilePath = `${destination}/${pitFileName}`

  const remotePitFile = await PifFileLoader.loadFromFile(pitfilePath)
  logger.info("\n%s", JSON.stringify(remotePitFile, null, 2))

  return remotePitFile
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

const deployLockManager = async (isEnabled: boolean, namespace: string, lockManagerPort: number) => {
  if (isEnabled) {
    logger.info("%s Deploying 'Lock Manager' on port %s %s", LOG_SEPARATOR_LINE, lockManagerPort, LOG_SEPARATOR_LINE)
    logger.info("")
    await Deployer.deployLockManager(namespace, lockManagerPort)
    logger.info("")
  } else {
    logger.info("%s The 'Lock Manager' will not be deployed %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
    logger.info("")
  }
}

const deploy = async (
    config: Config,
    pitfile: SchemaV1.PitFile,
    seqNumber: string,
    testSuite: SchemaV1.TestSuite,
    workspace: string,
    testAppDirForRemoteTestSuite?: string) => {
  logger.info("%s Processing test suite '%s' %s", LOG_SEPARATOR_LINE, testSuite.name, LOG_SEPARATOR_LINE)
  logger.info("deploy(): testSuite: '%s', workspace='%s'", testSuite.name, workspace)
  const namespace = await k8s.generateNamespaceName(seqNumber)
  await k8s.createNamespace(namespace, config.namespaceTimeoutSeconds, workspace)

  await deployLockManager(pitfile.lockManager.enabled, namespace, testSuite.lockManagerPort)

  await deployGraph(testSuite.deployment.graph, workspace, namespace, testAppDirForRemoteTestSuite)
}

const processRemoteTestSuite = async (config: Config, pitfile: SchemaV1.PitFile, seqNumber: string, testSuite: SchemaV1.TestSuite) => {
  // - - - - - - - - - - - - - - - - - - - - -
  // Prepare destination directory name
  const date = new Date()
  const timeToken = date.getMonth() + "" + date.getDay() + "" + date.getHours() + "" + date.getMinutes() + "" + date.getSeconds() + "" + date.getMilliseconds()
  const workspace = `testsuite${timeToken}_${testSuite.id}`
  await createWorkspace(workspace, testSuite.name)
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

  const remotePitFile = await downloadRemotePitFile(testSuite, destination)

  // Extract test suites from remote file where IDs are matching definition of local ones
  for (let subSeqNr = 0; subSeqNr < remotePitFile.testSuites.length; subSeqNr++) {
    const remoteTestSuite = remotePitFile.testSuites[subSeqNr]
    const ids = testSuite.testSuiteIds || []
    const shouldInclude = (ids.length === 0) || (ids.find(id => id === testSuite.id) !== undefined)
    if (!shouldInclude) {
      logger.info("Skipping remote test suite: '%s'", remoteTestSuite.name)
      continue
    }

    const combinedSeqNumber = `${seqNumber}s${(subSeqNr+1)}`
    remoteTestSuite.lockManagerPort = testSuite.lockManagerPort
    const testAppDirForRemoteTestSuite = destination
    logger.info("testAppDirForRemoteTestSuite='%s'", testAppDirForRemoteTestSuite)
    await deploy(config, pitfile, combinedSeqNumber, remoteTestSuite, workspace, testAppDirForRemoteTestSuite)
  }
}

const processTestSuite = async (config: Config, pitfile: SchemaV1.PitFile, seqNumber: string, testSuite: SchemaV1.TestSuite) => {
  if (testSuite.location.type === SchemaV1.LocationType.Local) {
    const workspace = "."
    await deploy(config, pitfile, seqNumber, testSuite, workspace)
  } else {
    await processRemoteTestSuite(config, pitfile, seqNumber, testSuite)
  }
}

export { processTestSuite }