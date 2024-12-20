import * as fs from "fs"

import { Config } from "./config.js"
import { logger } from "./logger.js"
import { CommitSha, DeployedComponent, Namespace, Schema } from "./model.js"
import { LocationType } from "./pitfile/schema-v1.js"
import * as Shell from "./shell-facade.js"

export class DeployOptions {
  namespace?: Namespace
  deployerParams?: Array<string>
}

const getLockManagerConfig = (): Schema.LockManager => {
  return {
    name: "Lock Manager",
    id: "lock-manager",
    deploy: {
      command: "deployment/pit/deploy.sh",
      statusCheck: {
        command: "deployment/pit/is-deployment-ready.sh"
      }
    },
    undeploy: {
      timeoutSeconds: 120,
      command: "deployment/pit/undeploy.sh",
    }
  } as Schema.LockManager
}

const isExecutable = async (filePath: string) => {
  try {
    await fs.promises.access(filePath, fs.constants.X_OK)
  } catch (e) {
      throw new Error(`There is no ${filePath} or it is not executable.`, { cause: e })
  }
}

/*
  Description: function isDirectoryExists: the purpose of this function is for checking the application directory is whether exists or not

  Usage example:
    // Assuming we have a project root directory /workspace, and we have 1 sub directory under /workspace, which is /workspace/project-directory
    // eg: /workspace
    //  - project-directory

    const isApplicationDirectoryExists = await isDirectoryExists('/workspace/project-directory') // return as true and it means application directory exists and accessible
    const isApplicationDirectoryExists = await isDirectoryExists('/workspace/some-other-directory') // return as false because some-other-directory does not exist and it means application directory does not exist and not accessible
*/
const isDirectoryExists = async (filePath: string): Promise<boolean> => {
  try {
    logger.info("isDirectoryExists(): checking if dir exists: %s", filePath)
    await fs.promises.access(filePath, fs.constants.F_OK)
    logger.info("isDirectoryExists(): checking if dir exists: %s. Yes", filePath)
    return true
  } catch (e) {
    logger.warn("isDirectoryExists(): There is no %s or it is not accessible.", filePath, { cause: e })
    return false
  }
}

export const cloneFromGit = async (appId: string, location: Schema.Location, targetDirectory: string): Promise<CommitSha> => {
  logger.info("The '%s' will be copied from '%s' into %s' using '%s'", appId, location.gitRepository, targetDirectory, location.gitRef)
  const fullCommand = `k8s-deployer/scripts/git-co.sh ${ location.gitRepository } ${ location.gitRef } ${ targetDirectory }`
  logger.info("cloneFromGit(): Running: %s", fullCommand)
  const output = await Shell.exec(fullCommand)
  logger.info("\n%s", output)
  const commitShaLine = output.split("\n").filter(line => line.trim().startsWith("COMMIT_SHA="))
  if (commitShaLine.length === 0) {
    throw new Error(`Unexpected output from '${ fullCommand }'. Unable to find COMMIT_SHA token.`)
  } else if (commitShaLine.length !== 1) {
    throw new Error(`Unexpected output from '${ fullCommand }'. There are multiple COMMIT_SHA tokens: ${ JSON.stringify(commitShaLine) }`)
  }

  const commitSha = commitShaLine[0].replace("COMMIT_SHA=", "").trim()
  if (commitSha.length !== 7) {
    throw new Error(`Unexpected output from '${ fullCommand }'. The value of COMMIT_SHA token does not look like git commit sha. ${ { line: JSON.stringify(commitShaLine), parsed: commitSha } }`)
  }

  return commitSha
}

const addParamsToCommand = (cmd: string, pitfileParams?: Array<string>, deployOptions?: DeployOptions) => {
  let result = cmd
  const allParams = new Array()
  // first pass params delcared in the pitfile
  if (pitfileParams) {
    pitfileParams.forEach(v => allParams.push(v))
  }
  // then pass additional params computed by deployer
  if (deployOptions?.deployerParams) {
    deployOptions.deployerParams.forEach(v => allParams.push(v))
  }
  for (let param of allParams) {
    result = `${result} ${param}`
  }

  return result
}

export const deployApplication = async (
  workspace: string,
  namespace: Namespace,
  appId: string,
  appDirectory: string,
  instructions: Schema.DeployInstructions,
  deployCheckFrequencyMs?: number,
  options?: DeployOptions) => {
  await isExecutable(`${ appDirectory }/${ instructions.command }`)
  
  try {
    // Invoke deployment script
    logger.info("Invoking: '%s/%s'", appDirectory, instructions.command)
    let command = instructions.command
    if (options?.namespace) command = `${ command } ${ options.namespace }`
    
    command = addParamsToCommand(command, instructions.params, options)

    const logFileName = `${ workspace }/logs/deploy-${ namespace }-${ appId }.log`
    const opts: any = { homeDir: appDirectory, logFileName, tailTarget: (line: string) => {
      if (line.toLowerCase().startsWith("error:")) {
        logger.error("%s", line)
      } else {
        logger.info("%s", line)
      }
    }}
    if (instructions.timeoutSeconds) opts.timeoutMs = instructions.timeoutSeconds * 1_000
    await Shell.exec(command, opts)

  } catch (e) {
    throw new Error(`Error invoking deployment launcher: '${instructions.command}'`, { cause: e })
  }

  // await TailLog.monitorProgress(logFile, startedAt, (instructions.timeoutSeconds || 60) * 1_000)

  if (!instructions.statusCheck) return

  await isExecutable(`${ appDirectory }/${ instructions.statusCheck.command }`)
  const timeoutSeconds = instructions.statusCheck.timeoutSeconds || 60
  logger.info("Invoking '%s/%s' for '%s' with timeout of %s seconds", appDirectory, instructions.statusCheck.command, appId, timeoutSeconds)
  const checkStartedAt = new Date().getTime()
  const checkSleepMs = deployCheckFrequencyMs || 5_000
  while (true) {
    const sleep = new Promise(resolve => setTimeout(resolve, checkSleepMs))
    await sleep

    const elapsed = new Date().getTime() - checkStartedAt
    if (elapsed >= instructions.statusCheck.timeoutSeconds * 1_000) {
      throw new Error(`Timeout while checking for ready status of ${ appId }. See logs for details.`)
    }

    try {
      let command = instructions.statusCheck.command
      if (options?.namespace) command = `${ command } ${ options?.namespace }`

      command = addParamsToCommand(command, instructions.params)
      await Shell.exec(command, { homeDir: appDirectory })

      logger.info("Success")
      break
    } catch (e) {
      // Not paniking yet, keep trying
      logger.info(e)
    }
  }
}

const undeployApplication = async (
  workspace: string,
  namespace: Namespace,
  appId: string,
  appDirectory: string,
  instructions: Schema.DeployInstructions,
  logsDir?: string) => {
  await isExecutable(`${appDirectory}/${instructions.command}`)
  try {
    logger.info("Invoking: '%s/%s'", appDirectory, instructions.command)
    const timeoutMs = instructions.timeoutSeconds * 1_000

    logsDir = logsDir || `${ workspace }/logs`
    const logFileName = `${ logsDir }/undeploy-${ namespace }-${ appId }.log`
    let command = `${ instructions.command } ${ namespace }`
    command = addParamsToCommand(command, instructions.params)

    const opts: any = { homeDir: appDirectory, logFileName, timeoutMs, tailTarget: (line: string) => {
      if (line.toLowerCase().startsWith("error:")) {
        logger.error("%s", line)
      } else {
        logger.info("%s", line)
      }
    }}
    if (instructions.timeoutSeconds) opts.timeoutMs = instructions.timeoutSeconds * 1_000
    await Shell.exec(command, opts)

  } catch (e) {
    throw new Error(`Error invoking undeployment launcher: '${instructions.command}'`, { cause: e })
  }
}

// setAppDirectory is used to set app directory value based on the result of isDirectoryExists function
const setAppDirectory = async (appDir: string, specId: string): Promise<string> => {
  if (!appDir || !specId) throw new Error('appDir or specId value is missing')

  const isApplicationDirectoryExists = await isDirectoryExists(appDir)

  return isApplicationDirectoryExists ? specId : '.'
}

export const deployLockManager = async (config: Config, workspace: string, namespace: Namespace) => {
  const spec = getLockManagerConfig()
  const appName = spec.id
  // directory where CI checked out sources of LockManager app
  const sourcesDirectory = "lock-manager"
  const webAppContextRoot = "lock-manager"
  logger.debug("Check config 'config.useMockLockManager': %s", typeof config.useMockLockManager, config.useMockLockManager);
  if (config.useMockLockManager) {
    logger.info("Lock manager mock is enabled. Skipping deployment of LockManager app.")
  } else {
    await deployApplication(
      workspace,
      namespace,
      appName,
      sourcesDirectory,
      spec.deploy,
      config.deployCheckFrequencyMs,
      { namespace, deployerParams: [ webAppContextRoot ] }
    )
  }
}

export const undeployLockManager = async (config: Config, workspace: string, namespace: Namespace) => {
  const spec = getLockManagerConfig()
  if (config.useMockLockManager) {
    logger.info("Lock manager mock is enabled. Skipping undeployment of LockManager app.")
  } else {
    let appDir = spec.id
    await undeployApplication(workspace, namespace, spec.id, appDir, spec.undeploy, appDir)
  }
}

export const deployComponent = async (
    config: Config,
    workspace: string,
    spec: Schema.DeployableComponent,
    namespace: Namespace,
    deployerParams?: Array<string>): Promise<CommitSha> => {
  let appDir = `${ workspace }/${ spec.id }`
  let commitSha: CommitSha
  if (spec.location.type === Schema.LocationType.Remote) {
    commitSha = await cloneFromGit(spec.id, spec.location, appDir)
  } else {
    logger.info("Reading commit sha of local project: '%s'", appDir)

    if (spec.location.path) {
      appDir = spec.location.path
      logger.info("The application directory will be taken from 'location.path' attribute: '%s' of '%s'", appDir, spec.name)
    } else {
      appDir = await setAppDirectory(`./${ spec.id }`, spec.id)

      logger.info("The application directory will be taken from 'id' attribute: '%s' of '%s'", appDir, spec.name)
    }
    commitSha = await Shell.exec(`cd ${ appDir } && git log --pretty=format:"%h" -1`)
  }

  await deployApplication(workspace, namespace, spec.id, appDir, spec.deploy, config.deployCheckFrequencyMs, { namespace, deployerParams })
  return commitSha
}

export const undeployComponent = async (workspace: string, namespace: Namespace, deploymentInfo: DeployedComponent) => {
  const spec = deploymentInfo.component
  let appDir = `${workspace}/${ spec.id }`

  if (spec.location.type === LocationType.Local) {
    if (spec.location.path) {
      appDir = spec.location.path
      logger.info("The application directory will be taken from 'location.path' attribute: '%s' of '%s'", appDir, spec.name)
    } else {
      appDir = await setAppDirectory(`./${ spec.id }`, spec.id)

      logger.info("The application directory will be taken from 'id' attribute: '%s' of '%s'", appDir, spec.name)
    }
  }

  await undeployApplication(workspace, namespace, spec.id, appDir, spec.undeploy)
}