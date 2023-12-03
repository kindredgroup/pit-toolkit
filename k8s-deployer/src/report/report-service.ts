import { Config } from "../config.js"
import { TestReport } from "../test-app-client/report/schema-v1.js"
import * as Shell from "../shell-facade.js"
import { Namespace, Prefix } from "../model.js"
import { logger } from "../logger.js"

import * as fs from "fs"

export const store = async (
  prefix: Prefix,
  config: Config,
  namespace: Namespace,
  workspace: string,
  testSuiteId: string,
  report: TestReport) => {

  const homeDir = `${ workspace }/reports`
  const timeoutMs = 60_000
  const logFile = `${ workspace }/logs/publish-report-for-${ testSuiteId }_${ namespace }.log`
  const reportFileJson = `${ homeDir }/${ testSuiteId }_${ namespace }_pit-report.json`
  const reportFileHtml = `${ homeDir }/${ testSuiteId }_${ namespace }_pit-report.html`
  const reportJson = JSON.stringify(report, null, 2)

  try {
    fs.mkdirSync(homeDir, { recursive: true })
    fs.writeFileSync(reportFileJson, reportJson)
    logger.info("Test suite: '%s' - JSON report is stored to '%s'", testSuiteId, reportFileJson)
    logger.info("\n%s", reportFileJson)
  } catch (e) {
    const message = `Error saving report for '${ testSuiteId }' into '${ reportFileJson }'.`
    throw new Error(message, { cause: e })
  }

  const reportHtmlTemplate = await Shell.exec(`cat k8s-deployer/report-template.html`)
  const startToken = "///<report-template>"
  const reportHtml = reportHtmlTemplate.replace(`${ startToken }`, `${ startToken }\nvar REPORT=${ reportJson }`)
  try {
    fs.writeFileSync(reportFileHtml, reportHtml)
    logger.info("Test suite: '%s' - HTML report is stored to '%s'", testSuiteId, reportFileHtml)
  } catch (e) {
    const message = `Error saving report for '${ testSuiteId }' into '${ reportFileHtml }'.`
    throw new Error(message, { cause: e })
  }

  let storageDir = ""
  storageDir = `${ storageDir }${ prefix }`            // this gives natural direcgtory order by date and time
  storageDir = `${ storageDir }_${ testSuiteId }`       // this gives indication what has generated the report
  storageDir = `${ storageDir }_${ config.commitSha }`  // the global commit sha which triggered build

  const commitMessage = `pit-report: ${ testSuiteId }`

  let command = `k8s-deployer/scripts/publish-report.sh`
  command = `${ command } ${ workspace }`
  command = `${ command } reports`
  command = `${ command } "${ config.report.gitRepository }"`
  command = `${ command } "${ config.report.branchName }"`
  command = `${ command } ${ storageDir }`
  command = `${ command } "${ commitMessage }"`

  await Shell.exec(command, { logFileName: logFile, timeoutMs, tailTarget: (line: string) => logger.info(line) })
}