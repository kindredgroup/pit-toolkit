import { logger } from "./logger.js"
import * as fs from "node:fs"

import * as NodeShell from "node:child_process"

const main = async () => {
  const workspaceDir = process.argv[2]

  const logFilePath = "./post-test-actions.log"
  const out = fs.openSync(logFilePath, 'a')
  const err = fs.openSync(logFilePath, 'a')

  const result = NodeShell.execSync(
    `scripts/find-reports.sh ${workspaceDir}`
  )

  logger.info("results: %s", result)
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })