import * as pitfile from "./pitfile/schema-v1.js"
import { logger } from "./logger.js"

import * as Shell from "child_process"
import * as fs from "fs"
import { open } from "fs/promises"

const STATUS_DONE = "Status=DONE"
const STATUS_ERROR = "Status=ERROR"

const waitForLogFile = async (logFile: string, timeoutMs: number): Promise<fs.promises.FileHandle> => {
  const startedAt = new Date().getTime()
  let logFileHandle: fs.promises.FileHandle
  while (!logFileHandle) {
    const sleep = new Promise(resolve => setTimeout(resolve, 500))
    await sleep
    try {
      logFileHandle = await open(logFile)
      return logFileHandle
    } catch (e) {
      const elapsed = new Date().getTime() - startedAt
      if (elapsed >= timeoutMs) {
        throw new Error(`No log file found after ${elapsed}ms. Expected file at: ${logFile}`)
      }
      logger.info("Still waiting for %s...", logFile)
    }
  }
}

const isExecutable = async (filePath: string) => {
  try {
    await fs.promises.access(filePath, fs.constants.X_OK)
  } catch (e) {
      throw new Error(`There is no ${filePath} or it is not executable.`, { cause: e })
  }
}

const monitorProgress = async (logFile: string, startedAt: number, deploymentTimeoutMs: number) => {
  let stopLineFound = false
  let logFileHandle = await waitForLogFile(logFile, 3000)
  let deploymentError = false
  let printedLines = 0
  const watcher: fs.FSWatcher = fs.watch(logFile, async (_event) => {
    try {
      const logContent = fs.readFileSync(logFile).toString("utf-8")
      const lines = logContent.split("\n")
      for (let lineNr = printedLines; lineNr < lines.length; lineNr++) {
        printedLines = lineNr

        const line = lines[lineNr]
        if (line === STATUS_DONE) {
          stopLineFound = true
          return
        }
        if (line == STATUS_ERROR) {
          stopLineFound = true
          deploymentError = true
          return
        }
        if (line.toLowerCase().startsWith("error:")) {
          logger.error("%s", line)
        } else {
          logger.info("%s", line)
        }
      }
    } catch (e) {
      logger.error("Error processing file watcher event")
      logger.error(e)
    }
  })

  while (!stopLineFound) {
    const elapsed = new Date().getTime() - startedAt
    if (elapsed >= deploymentTimeoutMs) {
      throw new Error(`Timeout deploying app. Waited for: ${elapsed}ms. See log for more details: '${logFile}'`)
    }
    const sleep = new Promise(resolve => setTimeout(resolve, 1000))
    await sleep
  }
  logFileHandle?.close()
  watcher?.close()

  if (deploymentError) {
    throw new Error(`Error deploying app, see log for more details: '${logFile}'`)
  }
}

const deployApplication = async (appName: string, appDirectory: string, instructions: pitfile.DeployInstructions) => {
  const startedAt = new Date().getTime()
  const logFileName = `${appName}-deploy.log`
  const logFile = `${appDirectory}/${logFileName}`

  await isExecutable(`${appDirectory}/${instructions.command}`)

  try {
    // Invoke deployment script
    Shell.exec(`cd ${appDirectory}; ${instructions.command} ${STATUS_DONE} ${STATUS_ERROR} > ./${logFileName} 2>&1`)
  } catch (e) {
    throw new Error(`Error invoking deployment launcher: '${instructions.command}'`, { cause: e })
  }

  await monitorProgress(logFile, startedAt, (instructions.timeoutSeconds || 60) * 1_000)

  if (!instructions.statusCheck) return

  await isExecutable(`${appDirectory}/${instructions.statusCheck.command}`)
  const timeoutSeconds = instructions.statusCheck.timeoutSeconds || 60
  logger.info("Invoking %s for \"%s\" with timeout of %s seconds", instructions.statusCheck.command, appName, timeoutSeconds)
  const checkStartedAt = new Date().getTime()
  while (true) {
    const sleep = new Promise(resolve => setTimeout(resolve, 5_000))
    await sleep

    const elapsed = new Date().getTime() - checkStartedAt
    if (elapsed >= instructions.statusCheck.timeoutSeconds * 1_000) {
      throw new Error(`Timeout while checking for ready status of ${appName}. See logs for details.`)
    }
    try {
      const checkLog = Shell.execSync(`cd ${appDirectory}; ${instructions.statusCheck.command}`)
      logger.info("Success", checkLog)
      logger.info("Output: %s", checkLog)
      break
    } catch (e) {
      // Not paniking yet, keep trying
      logger.info(e)
    }
  }
}

const deployLockManager = async (spec: pitfile.LockManager) => {
  if (spec.location.type === pitfile.LocationType.Local) {
    logger.info("deploying Lock Manager from local sources")
  } else {
    logger.info("deploying Lock Manager from '%s' using '%s'", spec.location.gitRepository, spec.location.gitRef)
  }

  const appDirectory = "lock-manager"
  if (process.env["PIT_DEV_MODE"]) {
    logger.info("PIT_DEV_MODE is on. Lock Manager will be copied from project root")
    logger.info("\n%s", Shell.execSync(`rsync -avhq --delete --executability ../../../${appDirectory} .`))
  }

  await deployApplication("lock-manager", appDirectory, spec.deploy)
}

const deployComponent = async (spec: pitfile.DeployableComponent) => {
  // TODO: check location

  let appDir = spec.location.path || spec.id

  await deployApplication(spec.id, appDir, spec.deploy)
}

export { deployLockManager, deployComponent, deployApplication }