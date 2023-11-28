import * as Shell from "node:child_process"
import * as fs from "fs"
import { open } from "fs/promises"

import { logger } from "./logger.js"

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// These two constants are shared with our 'deployment/pit/deploy.sh' scripts
// TODO: find better way to detect failure of async process.
export const STATUS_DONE = "Status=DONE"
export const STATUS_ERROR = "Status=ERROR"
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

export class ShellOptions {
  homeDir?: string
  logFileName?: string
  timeoutMs?: number
  tailTarget?: (content: string) => void
}

class FileReadingState {
  linesRead: number = 0
  stoppedWithStatusDone: boolean | null = null

  constructor(readonly file: string) {}
}

const waitForFile = async (logFile: string, timeoutMs: number): Promise<fs.promises.FileHandle> => {
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

const readFile = (file: string): string => {
  // This is more reliable way to read the full file content. File reading functions from node 'fs' package
  // sometimes do not see the last line. Huh!?
  return Shell.execSync(`cat ${file}`).toString("utf-8")
}

/** This function mutates state */
const tailLogFile = (state: FileReadingState, propagateError: boolean, fnTailTarget?: (content: string) => void) => {
  try {
    const logContent = readFile(state.file)
    const lines = logContent.split("\n")
    for (let lineNr = state.linesRead; lineNr < lines.length; lineNr++) {
      state.linesRead = lineNr
      const line = lines[lineNr]
      if (line === STATUS_DONE) {
        state.stoppedWithStatusDone = true
        break
      }
      if (line == STATUS_ERROR) {
        state.stoppedWithStatusDone = false
        break
      }

      if (line.trim().length > 0) {
        fnTailTarget(line)
      }
    }
  } catch (e) {
    logger.error("Error tailing file '%s'", state.file)
    logger.error(e)
    if (propagateError) throw e
  }
}

/** This function mutates state */
const monitorProgress = async (state: FileReadingState, timeoutMs: number, errorPrefix: string, fnTailTarget?: (content: string) => void) => {
  const startedAt = new Date().getTime()
  let iteration = 1
  while (state.stoppedWithStatusDone == null) {
    // logger.debug("iteration: %s state: %s", iteration, JSON.stringify(state))
    const elapsed = new Date().getTime() - startedAt
    // Handle the timeout
    if (elapsed >= timeoutMs) {
      tailLogFile(state, true, fnTailTarget)
      if (state.stoppedWithStatusDone == null) {
        throw new Error(`Timeout deploying app. Waited for: ${elapsed}ms. See log for more details: '${state.file}'`)
      }
    }

    const sleep = new Promise(resolve => setTimeout(resolve, 1000))
    await sleep
    if ((iteration === 1) || ((iteration % 3) === 0)) {
      // Helpful if file watcher missed the changes in the file. Can happen when file content was fully written before
      // watcher started to watch.
      tailLogFile(state, true, fnTailTarget)
    }
    iteration++
  }

  // It looks like we have finished observing the file. If we detected the error marker in the file then
  // raise the exception. This will indicate to the caller that async process did not finish successfully.
  if (state.stoppedWithStatusDone != null && state.stoppedWithStatusDone === false) {
    throw new Error(`${errorPrefix}, see log for more details: '${state.file}'`)
  }
}

export const exec = async (cmd: string, options?: ShellOptions): Promise<string | undefined> => {
  if (!options) {
    return Shell.execSync(cmd).toString("utf-8")
  }

  if (options.tailTarget && !options.logFileName) {
    throw new Error("Option 'logFileName' is required when specifying 'tailTarget'")
  }

  let command = cmd
  if (options.homeDir) command = `cd ${options.homeDir}; ${command}`

  if (!options.tailTarget) {
    return Shell.execSync(command).toString("utf-8")
  }
  command = `${command} > `
  if (options.logFileName.indexOf("/") == -1) command = `${command} ./`
  command = `${command}${options.logFileName} 2>&1`

  logger.info("Executing: '%s'", command)
  Shell.exec(command)

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Invocation was success, lets tail the log
  let logFile = options.logFileName
  if (options.homeDir) logFile = `${options.homeDir}/${logFile}`
  const logFileHandle = await waitForFile(logFile, 5_000)

  const state = new FileReadingState(logFile)

  // Stage 1. Setup file watcher. This is just optimisation. Watcher event will not be triggered if
  // file is already fully written. If that happened we will deal with it in stage 2.
  const watcher: fs.FSWatcher = fs.watch(logFile, async (_event) => {
    tailLogFile(state, false, options.tailTarget)
  })

  // Stage 2. Wait until command execution finishes or times out
  try {
    const timeout = options.timeoutMs || 60_000
    await monitorProgress(state, timeout, `Error executing command: '${command}'`, options.tailTarget)
  } finally {
    logFileHandle?.close()
    watcher?.close()
  }
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
}