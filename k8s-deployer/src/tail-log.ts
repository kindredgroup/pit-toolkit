import * as fs from "fs"
import { open } from "fs/promises"
import * as Shell from "child_process"

import { logger } from "./logger.js"

export const STATUS_DONE = "Status=DONE"
export const STATUS_ERROR = "Status=ERROR"

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

export const monitorProgress = async (logFile: string, startedAt: number, timeoutMs: number) => {
  let stopLineFound = false
  let logFileHandle = await waitForFile(logFile, 5_000)
  let deploymentError = false
  let printedLines = 0

  const fnReadFile = (): string => {
    return Shell.execSync(`cat ${logFile}`).toString("utf-8")
  }

  const fnCheckLogFile = (): boolean => {
    let stopped = false
    try {
      const logContent = fnReadFile()
      const lines = logContent.split("\n")
      for (let lineNr = printedLines; lineNr < lines.length; lineNr++) {
        printedLines = lineNr

        const line = lines[lineNr]
        if (line === STATUS_DONE) {
          stopped = true
          break
        }
        if (line == STATUS_ERROR) {
          stopped = true
          deploymentError = true
          break
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

    return stopped
  }

  const watcher: fs.FSWatcher = fs.watch(logFile, async (_event) => {
    stopLineFound = fnCheckLogFile()
  })

  let i = 1
  while (!stopLineFound) {
    const elapsed = new Date().getTime() - startedAt
    if (elapsed >= timeoutMs) {
      stopLineFound = fnCheckLogFile()
      if (!stopLineFound) {
        throw new Error(`Timeout deploying app. Waited for: ${elapsed}ms. See log for more details: '${logFile}'`)
      }
    }
    const sleep = new Promise(resolve => setTimeout(resolve, 1000))
    await sleep
    if ((i === 1) || ((i % 3) === 0)) {
      // Helpful if file watcher missed the changes in the file. Can happen when file content was fully written before
      // watcher strted to watch.
      stopLineFound = fnCheckLogFile()
    }
    i++
  }
  logFileHandle?.close()
  watcher?.close()

  if (deploymentError) {
    throw new Error(`Error deploying app, see log for more details: '${logFile}'`)
  }
}