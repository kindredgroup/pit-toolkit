import * as fs from "fs"

import { logger } from "./logger.js"
import { CommitSha, Namespace, Schema, DeployedComponent } from "./model.js"
import * as Shell from "./shell-facade.js"
import { LocationType } from "./pitfile/schema-v1.js"

export class DeployOptions {
  namespace?: Namespace
  servicePort?: number
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

export const cloneFromGit = async (application: string, location: Schema.Location, targetDirectory: string): Promise<CommitSha> => {
  logger.info("The '%s' will be copied from '%s' into %s' using '%s'", application, location.gitRepository, targetDirectory, location.gitRef)
  const fullCommand = `k8s-deployer/scripts/git-co.sh ${location.gitRepository} ${location.gitRef} ${targetDirectory}`
  logger.info("cloneFromGit(): Running: %s", fullCommand)
  const output = await Shell.exec(fullCommand)
  logger.info("\n%s", output)
  const commitShaLine = output.split("\n").filter(line => line.trim().startsWith("COMMIT_SHA="))
  if (commitShaLine.length === 0) {
    throw new Error(`Unexpected output from '${ fullCommand }'. Unable to find COMMIT_SHA token.`)
  } else if (commitShaLine.length !== 1) {
    throw new Error(`Unexpected output from '${ fullCommand }'. There are multimple COMMIT_SHA tokens: ${ JSON.stringify(commitShaLine) }`)
  }

  const commitSha = commitShaLine[0].replace("COMMIT_SHA=", "").trim()
  if (commitSha.length !== 7) {
    throw new Error(`Unexpected output from '${ fullCommand }'. The value of COMMIT_SHA token does not look like git commit sha. ${ { line: JSON.stringify(commitShaLine), parsed: commitSha } }`)
  }

  return commitSha
}

export const deployApplication = async (
  appName: string,
  appDirectory: string,
  instructions: Schema.DeployInstructions,
  options?: DeployOptions) => {
  await isExecutable(`${appDirectory}/${instructions.command}`)

  try {
    // Invoke deployment script
    logger.info("Invoking: '%s/%s'", appDirectory, instructions.command)
    let command = instructions.command
    if (options?.namespace) command = `${command} ${options.namespace}`
    if (options?.servicePort) command = `${command} ${options.servicePort}`

    const allParams = new Array()
    // first pass params delcared in the pitfile
    if (instructions.params) {
      instructions.params.forEach(v => allParams.push(v))
    }
    // then pass additional params computed by deployer
    if (options?.deployerParams) {
      options.deployerParams.forEach(v => allParams.push(v))
    }
    for (let param of allParams) {
      command = `${command} ${param}`
    }

    const timeoutMs = instructions.timeoutSeconds * 1_000
    const logFileName = `${appName}-deploy.log`
    await Shell.exec(command, { homeDir: appDirectory, logFileName, timeoutMs, tailTarget: line => {
      if (line.toLowerCase().startsWith("error:")) {
        logger.error("%s", line)
      } else {
        logger.info("%s", line)
      }
    }})

  } catch (e) {
    throw new Error(`Error invoking deployment launcher: '${instructions.command}'`, { cause: e })
  }

  // await TailLog.monitorProgress(logFile, startedAt, (instructions.timeoutSeconds || 60) * 1_000)

  if (!instructions.statusCheck) return

  await isExecutable(`${appDirectory}/${instructions.statusCheck.command}`)
  const timeoutSeconds = instructions.statusCheck.timeoutSeconds || 60
  logger.info("Invoking '%s/%s' for '%s' with timeout of %s seconds", appDirectory, instructions.statusCheck.command, appName, timeoutSeconds)
  const checkStartedAt = new Date().getTime()
  while (true) {
    const sleep = new Promise(resolve => setTimeout(resolve, 5_000))
    await sleep

    const elapsed = new Date().getTime() - checkStartedAt
    if (elapsed >= instructions.statusCheck.timeoutSeconds * 1_000) {
      throw new Error(`Timeout while checking for ready status of ${appName}. See logs for details.`)
    }

    try {
      let command = instructions.statusCheck.command
      if (options?.namespace) command = `${command} ${options?.namespace}`
      await Shell.exec(command, { homeDir: appDirectory })

      logger.info("Success")
      break
    } catch (e) {
      // Not paniking yet, keep trying
      logger.info(e)
    }
  }
}

const undeployApplication = async (appName: string, appDirectory: string, namespace: Namespace, instructions: Schema.DeployInstructions) => {
  logger.info("Undeploying app: '%s'", appName)

  await isExecutable(`${appDirectory}/${instructions.command}`)
  try {
    logger.info("Invoking: '%s/%s'", appDirectory, instructions.command)
    const timeoutMs = instructions.timeoutSeconds * 1_000
    const logFileName = `${appName}-undeploy.log`
    const command = `${ instructions.command } ${ namespace }`
    await Shell.exec(command, { homeDir: appDirectory, logFileName, timeoutMs, tailTarget: line => {
      if (line.toLowerCase().startsWith("error:")) {
        logger.error("%s", line)
      } else {
        if (line.trim().length !== 0) logger.info("%s", line)
      }
    }})
  } catch (e) {
    throw new Error(`Error invoking undeployment launcher: '${instructions.command}'`, { cause: e })
  }
}

export const deployLockManager = async (namespace: Namespace) => {
  const spec = getLockManagerConfig()
  await deployApplication(spec.id, spec.id, spec.deploy, { namespace, deployerParams: [ 'lock-manager' ] })
}

export const undeployLockManager = async (namespace: Namespace) => {
  const spec = getLockManagerConfig()
  await undeployApplication(spec.id, spec.id, namespace, spec.undeploy)
}

export const deployComponent = async (
    workspace: string,
    spec: Schema.DeployableComponent,
    namespace: Namespace,
    deployerParams?: Array<string>): Promise<CommitSha> => {
  let appDir = `${workspace}/${spec.id}`
  let commitSha: CommitSha
  if (spec.location.type === Schema.LocationType.Remote) {
    commitSha = await cloneFromGit(spec.id, spec.location, appDir)
  } else {
    logger.info("Reading commit sha of local project: '%s'", appDir)

    if (spec.location.path) {
      appDir = spec.location.path
      logger.info("The application directory will be taken from 'location.path' attribute: '%s' of '%s'", appDir, spec.name)
    } else {
      appDir = spec.id
      logger.info("The application directory will be taken from 'id' attribute: '%s' of '%s'", appDir, spec.name)
    }
    commitSha = await Shell.exec(`cd ${ appDir } && git log --pretty=format:"%h" -1`)
  }

  await deployApplication(spec.id, appDir, spec.deploy, { namespace, deployerParams })
  return commitSha
}

export const undeployComponent = async (namespace: Namespace, workspace: string, deploymentInfo: DeployedComponent) => {
  const spec = deploymentInfo.component
  let appDir = `${workspace}/${ spec.id }`

  if (spec.location.type === LocationType.Local) {
    if (spec.location.path) {
      appDir = spec.location.path
      logger.info("The application directory will be taken from 'location.path' attribute: '%s' of '%s'", appDir, spec.name)
    } else {
      appDir = spec.id
      logger.info("The application directory will be taken from 'id' attribute: '%s' of '%s'", appDir, spec.name)
    }
  }

  await undeployApplication(spec.id, appDir, namespace, spec.undeploy)
}