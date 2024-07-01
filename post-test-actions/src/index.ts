import { logger } from "./logger.js"

import * as fs from "fs"
import * as NodeShell from "node:child_process"
import { TestReport } from "./report/schema-v1.js"
import { TeamsPublisher } from "./teams/core.js"
import { readParams } from "./bootrstrap.js"

const main = async () => {
  const config = readParams()

  if (config.testPassActions.length == 0 && config.testFailActions.length == 0) {
    logger.warn("No actions where configured. Program will exist now.")
    return
  }

  logger.info("%s", JSON.stringify(config, null, 2))

  logger.info("Searching for report files in '%s'", config.workspaceDir)
  const lookupResultsRaw = NodeShell.execSync(`scripts/find-reports.sh ${ config.workspaceDir }`)
  if (lookupResultsRaw.toString().length == 0) {
    logger.info("There are no PIT reports found in '%s'", config.workspaceDir)
    process.exit(1)
  }
  const lookupResults = lookupResultsRaw.toString().split("\n").map(v => v.trim()).filter(v => v.length > 0)
  // process each report file....
  for (let lookupResult of lookupResults) {
    logger.info("Processing: %s", lookupResult)

    const reportContent = fs.readFileSync(lookupResult.toString().trim(), "utf8")
    let report: TestReport
    try {
      report = JSON.parse(reportContent) as TestReport
    } catch (e) {
      throw Error("Unable to parse report content as JSON", { cause: e })
    }

    if (config.teamsConfig) {
      const teams = TeamsPublisher.init(config.teamsConfig, config.dryRun)
      teams.executeActions(config, report)
    } else {
      logger.warn("Teams publisher module is not active.")
    }
  }
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })