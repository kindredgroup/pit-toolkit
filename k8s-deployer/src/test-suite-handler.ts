import * as fs from "fs"

import { LOG_SEPARATOR_LINE, logger } from "./logger.js"
import { DeployedComponent, DeployedTestSuite, GraphDeploymentResult, Namespace, Prefix, Schema } from "./model.js"
import * as Deployer from "./deployer.js"
import { Config } from "./config.js"
import * as PifFileLoader from "./pitfile/pitfile-loader.js"
import * as K8s from "./k8s.js"
import * as TestRunner from "./test-app-client/test-runner.js"
import * as Shell from "./shell-facade.js"

/**
 * Deploying:
 *  1. all components in the graph,
 *  2. test app for the graph.
 */
const deployGraph = async (config: Config, workspace: string, testSuiteId: string, graph: Schema.Graph, namespace: Namespace, testAppDirForRemoteTestSuite?: string): Promise<GraphDeploymentResult> => {
  const deployments: Array<DeployedComponent> = new Array()
  for (let i = 0; i < graph.components.length; i++) {
    const componentSpec = graph.components[i]
    logger.info("Deploying graph component (%s of %s) \"%s\"...", i + 1, graph.components.length, componentSpec.name)
    logger.info("")
    const commitSha = await Deployer.deployComponent(config, workspace, componentSpec, namespace)
    deployments.push(new DeployedComponent(commitSha, componentSpec))
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
  const params = [ testSuiteId ]
  const testAppCommitSha = await Deployer.deployComponent(config, workspace, graph.testApp, namespace, params)
  logger.info("")
  return new GraphDeploymentResult(deployments, new DeployedComponent(testAppCommitSha, graph.testApp))
}

const downloadPitFile = async (testSuite: Schema.TestSuite, destination: string): Promise<Schema.PitFile> => {
  await Deployer.cloneFromGit(testSuite.id, testSuite.location, destination)
  logger.info("Loading pitfile from remote test suite '%s'", testSuite.name)
  const pitFileName = testSuite.location.pitFile || PifFileLoader.DEFAULT_PITFILE_NAME
  const pitfilePath = `${ destination }/${ pitFileName }`
  const remotePitFile = await PifFileLoader.loadFromFile(pitfilePath)
  return remotePitFile
}

const createWorkspace = async (path: string) => {
  logger.info("Creating workspace '%s'", path)
  let directoryCreated = false
  try {
    await fs.promises.access(path, fs.constants.W_OK)
    directoryCreated = true
  } catch (e) {
    // all good, this is expected
  }
  if (directoryCreated) {
    throw new Error(`Cannot create new workspace '${path}'. Directory or file exists.`)
  }

  Shell.exec(`mkdir -p ${ path }/logs`)
  Shell.exec(`mkdir -p ${ path }/reports`)
  // This does not work properly
  // fs.mkdirSync(path)
  // fs.mkdirSync(`${ path }/logs`)
  // fs.mkdirSync(`${ path }/reports`)
}

const deployLockManager = async (config: Config, workspace: string, isEnabled: boolean, namespace: Namespace) => {
  if (!isEnabled) {
    logger.info("%s The 'Lock Manager' will not be deployed %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
    logger.info("")
    return
  }

  logger.info("%s Deploying 'Lock Manager' %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
  logger.info("")
  await Deployer.deployLockManager(config, workspace, namespace)
  logger.info("")
}

/**
 * - Creates namespace, 
 * - deploys lock manager,
 * - deploys components graph.
 */
const deployLocal = async (
    config: Config,
    workspace: string,
    pitfile: Schema.PitFile,
    seqNumber: string,
    testSuite: Schema.TestSuite,
    testAppDirForRemoteTestSuite?: string): Promise<DeployedTestSuite> => {
  logger.info("%s Processing test suite '%s' %s", LOG_SEPARATOR_LINE, testSuite.name, LOG_SEPARATOR_LINE)

  let ns = await K8s.generateNamespaceName(config, seqNumber)
  await K8s.createNamespace(workspace, config.parentNamespace, ns, config.namespaceTimeoutSeconds)

  if (process.env.MOCK_NS === "true") {
    ns = config.parentNamespace
  } else {
    logger.info("process.env.MOCK_NS=%s", process.env.MOCK_NS)
  }

  logger.info("NAMEPSACE IN USE=%s, process.env.MOCK_NS=%s", ns, process.env.MOCK_NS)

  await deployLockManager(config, workspace, pitfile.lockManager.enabled, ns)

  const deployedGraph = await deployGraph(config, workspace, testSuite.id, testSuite.deployment.graph, ns, testAppDirForRemoteTestSuite)

  return new DeployedTestSuite(workspace, ns, testSuite, deployedGraph)
}

const deployRemote = async (
  workspace: string,
  config: Config,
  pitfile: Schema.PitFile,
  seqNumber: string,
  testSuite: Schema.TestSuite): Promise<Array<DeployedTestSuite>> => {
  const list = new Array<DeployedTestSuite>()

  const destination = `${ workspace }/remotesuite_${ testSuite.id }`
  fs.mkdirSync(destination, { recursive: true })

  const remotePitFile = await downloadPitFile(testSuite, destination)

  // Extract test suites from remote file where IDs are matching definition of local ones
  // and deploy them one by one
  for (let subSeqNr = 0; subSeqNr < remotePitFile.testSuites.length; subSeqNr++) {
    const remoteTestSuite = remotePitFile.testSuites[subSeqNr]
    const ids = testSuite.testSuiteIds || []
    const shouldInclude = (ids.length === 0) || (ids.find(id => id === testSuite.id) !== undefined)
    if (!shouldInclude) {
      logger.info("Skipping remote test suite: '%s'", remoteTestSuite.name)
      continue
    }

    const combinedSeqNumber = `${seqNumber}e${(subSeqNr+1)}`
    const testAppDirForRemoteTestSuite = destination

    const summary = await deployLocal(config, workspace, pitfile, combinedSeqNumber, remoteTestSuite, testAppDirForRemoteTestSuite)

    list.push(summary)
  }

  return list
}

const deployAll = async (
  prefix: Prefix,
  config: Config,
  pitfile: Schema.PitFile,
  seqNumber: string,
  testSuite: Schema.TestSuite): Promise<Array<DeployedTestSuite>> => {

  const workspace = `${ prefix }_${ testSuite.id }`

  createWorkspace(workspace)

  const deployedSuites = new Array<DeployedTestSuite>()
  if (testSuite.location.type === Schema.LocationType.Local) {
    const summary = await deployLocal(config, workspace, pitfile, seqNumber, testSuite)
    deployedSuites.push(summary)
  } else {
    const list = await deployRemote(workspace, config, pitfile, seqNumber, testSuite)
    list.forEach(i => deployedSuites.push(i))
  }

  return deployedSuites
}

export const undeployAll = async (config: Config, pitfile: Schema.PitFile, suites: Array<DeployedTestSuite>) => {

  for (let item of suites) {
    if (pitfile.lockManager.enabled) {
      await Deployer.undeployLockManager(config, item.workspace, item.namespace)
    } else {
      logger.info("%s The 'Lock Manager' was not deployed %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
      logger.info("")        
    }

    await Deployer.undeployComponent(item.workspace, item.namespace, item.graphDeployment.testApp)
    for (let deploymentInfo of item.graphDeployment.components) {
      await Deployer.undeployComponent(item.workspace, item.namespace, deploymentInfo)
    }

    await K8s.deleteNamespace(config.parentNamespace, item.namespace, config.namespaceTimeoutSeconds, item.workspace)
  }
}

export const processTestSuite = async (
  prefix: Prefix,
  config: Config,
  pitfile: Schema.PitFile,
  seqNumber: string,
  testSuite: Schema.TestSuite): Promise<Array<DeployedTestSuite>> => {
  // By default assume processing strategy to be "deploy all then run tests one by one"

  logger.info("")
  logger.info("--------------- Processig %s ---------------", testSuite.id)
  logger.info("")
  const list = await deployAll(prefix, config, pitfile, seqNumber, testSuite)

  if (config.servicesAreExposedViaProxy) {
    logger.info("")
    logger.info("%s Deployment is done. Sleeping before running tests. %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
    logger.info("")    
    const sleep = new Promise(resolve => setTimeout(resolve, 2_000))
    await sleep
  }

  logger.info("")
  logger.info("%s Deployment is done. Running tests. %s", LOG_SEPARATOR_LINE, LOG_SEPARATOR_LINE)
  logger.info("")

  await TestRunner.runAll(prefix, config, list)

  return list
}
