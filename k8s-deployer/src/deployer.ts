import { logger } from "./logger.js"
import * as SchemaV1 from "./pitfile/schema-v1.js"
import * as Shell2 from "./shell-facade.js"

import * as fs from "fs"

export class DeployOptions {
  namespace?: string
  servicePort?: number
  deployerParams?: Array<string>
}

const isExecutable = async (filePath: string) => {
  try {
    await fs.promises.access(filePath, fs.constants.X_OK)
  } catch (e) {
      throw new Error(`There is no ${filePath} or it is not executable.`, { cause: e })
  }
}

const cloneFromGit = async (application: string, location: SchemaV1.Location, targetDirectory: string) => {
  logger.info("The '%s' will be copied from '%s' into %s' using '%s'", application, location.gitRepository, targetDirectory, location.gitRef)
  logger.info("\n%s",
    await Shell2.exec(`k8s-deployer/scripts/git-co.sh ${location.gitRepository} ${location.gitRef} ${targetDirectory}`)
  )
}

const deployApplication = async (
  appName: string,
  appDirectory: string,
  instructions: SchemaV1.DeployInstructions,
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
    await Shell2.exec(command, { homeDir: appDirectory, logFileName, timeoutMs, tailTarget: line => {
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
      await Shell2.exec(command, { homeDir: appDirectory })

      logger.info("Success")
      break
    } catch (e) {
      // Not paniking yet, keep trying
      logger.info(e)
    }
  }
}

const deployLockManager = async (namespace: string) => {
  const spec: SchemaV1.LockManager = {
    name: "Lock Manager",
    id: "lock-manager",
    deploy: {
      command: "deployment/pit/deploy.sh",
      statusCheck: {
        command: "deployment/pit/is-deployment-ready.sh"
      }
    }
  }

  await deployApplication(spec.id, spec.id, spec.deploy, { namespace, deployerParams: [ 'lock-manager' ] })
}

const deployComponent = async (
    workspace: string,
    spec: SchemaV1.DeployableComponent,
    namespace: string,
    deployerParams?: Array<string>) => {
  let appDir = `${workspace}/${spec.id}`
  if (spec.location.type === SchemaV1.LocationType.Remote) {
    await cloneFromGit(spec.id, spec.location, appDir)
  } else {
    if (spec.location.path) {
      appDir = spec.location.path
      logger.info("The application directory will be taken from 'location.path' attribute: '%s' of '%s'", appDir, spec.name)
    } else {
      appDir = spec.id
      logger.info("The application directory will be taken from 'id' attribute: '%s' of '%s'", appDir, spec.name)
    }
  }

  await deployApplication(spec.id, appDir, spec.deploy, { namespace, deployerParams })
}

export {
  cloneFromGit,
  deployApplication,
  deployComponent,
  deployLockManager
}