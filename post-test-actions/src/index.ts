import * as fs from "fs"
import * as NodeShell from "node:child_process"

import { logger } from "./logger.js"
import { TestOutcomeType, TestReport } from "./report/schema-v1.js"
import { TeamsPublisher } from "./teams/core.js"
import { readParams } from "./bootrstrap.js"
import { didTestFail } from "./report/utils.js"
import { GitTaggingService } from "./git-tag/core.js"
import { Config } from "./config.js"

type ReportInfo = { report: TestReport, isFailed: boolean }

const main = async () => {
  const config = readParams()

  if (config.testPassActions.length == 0 && config.testFailActions.length == 0) {
    logger.warn("No actions where configured. Program will exit now.")
    return
  }

  logger.info("%s", JSON.stringify(config, null, 2))

  logger.info("Searching for report files in '%s'", config.workspaceDir)
  const lookupResultsRaw = NodeShell.execSync(`${config.appRootDir}/scripts/find-reports.sh ${ config.workspaceDir }`)
  if (lookupResultsRaw.toString().length == 0) {
    logger.info("There are no PIT reports found in '%s'", config.workspaceDir)
    process.exit(1)
  }
  const lookupResults = lookupResultsRaw.toString().split("\n").map(v => v.trim()).filter(v => v.length > 0)

  const reports = loadReports(lookupResults)

  let failedReports = 0
  for (let reportInfo of reports) {
    logger.info("Processing report: \"%s\"", reportInfo.report.name)
    if (reportInfo.isFailed) failedReports++
    try {
      await processReport(config, reportInfo)
    } catch (e) {
      logger.error("Unable to process report: \"%s\". Error: %s", reportInfo.report.name, e.message)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
    }
  }

  if (failedReports > 0) {
    logger.info("Some of the analysed tests had %s outcome. The process will exit with code: %s", TestOutcomeType.FAIL, config.exitCode)
    process.exit(config.exitCode)
  }
}

/**
 * Loads reports and sorts them by outcome where failed reports are at the bottom of the list
 */
const loadReports = (paths: Array<string>): Array<ReportInfo> => {
  const allReports = new Array<ReportInfo>()
  const failedReports = new Array<ReportInfo>()
  for (let path of paths) {
    logger.info("Loading report from: %s", path)
    try {
      const report = loadReport(path)
      if (didTestFail(report)) {
        failedReports.push({ report, isFailed: true } )
      } else {
        allReports.push({ report, isFailed: false })
      }
    } catch (e) {
      logger.error(`Unable to load report from: ${ path }`, { cause: e })
    }
  }

  for (let r of failedReports) allReports.push(r)

  return allReports
}

const loadReport = (pathToReport: string): TestReport => {
  const reportContent = fs.readFileSync(pathToReport, "utf8")
  try {
    return JSON.parse(reportContent) as TestReport
  } catch (e) {
    throw Error("Unable to parse report content as JSON", { cause: e })
  }
}

const processReport = async (config: Config, reportInfo: ReportInfo) => {
  if (config.teamsConfig) {
    const teams = TeamsPublisher.init(config.teamsConfig, config.appRootDir, config.dryRun)
    await teams.executeActions(config, reportInfo.report)
  } else {
    logger.info("")
    logger.info("Teams publisher module is not active.")
    logger.info("")
  }

  if (config.gitConfig) {
    const taggingService = new GitTaggingService(config)
    await taggingService.executeActions(reportInfo.report)
  } else {
    logger.info("")
    logger.info("Git tagging module is not active.")
    logger.info("")
  }
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })