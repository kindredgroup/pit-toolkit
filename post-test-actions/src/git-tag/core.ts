import * as NodeShell from "node:child_process"

import { ActionType, Config } from "../config.js"
import { logger } from "../logger.js"
import { TestReport } from "../report/schema-v1.js"
import { didTestFail } from "../report/utils.js"

type TagInfo = { tag: string, sha: string }

export class GitTaggingService {
  constructor(
    private readonly config: Config) {}

    private readCommitSha = (workDir: string): string => {
      const script = `${this.config.appRootDir}/scripts/git-co.sh`
      let commitSha: string
      try {
        commitSha = NodeShell
          .execSync(`${this.config.appRootDir}/scripts/git-co.sh ${this.config.gitConfig.gitRepoUrl} ${this.config.gitConfig.gitRef} ${workDir}`)
          .toString()
          .trim()
      } catch (e) {
        throw new Error(`Error invoking script ${script}`, { cause: e })
      }

      if (commitSha.indexOf("COMMIT_SHA=") !== 0) {
        throw new Error(`Git checkout might have failed. Unexpected data returned from: "${script}"`)
      }

      commitSha = commitSha.substring(11)
      return commitSha
    }

    private getCurrentTags = (workDir: string): Array<TagInfo> => {
      // This comes in the format of "long-sha long-tag-name"
      const listOfTags = NodeShell
        .execSync(`${ this.config.appRootDir }/scripts/git-tags.sh ${ this.config.dryRun } read-tags ${ workDir }`)
        .toString()
        .trim()

      logger.info("getCurrentTags(): \n%s", listOfTags)

      // Convert into the list of "short sha, short tag name"
      const formattedList = listOfTags
        .split("\n")
        .map(v => v.trim())
        .filter(v => v.length > 0)
        .map(v => {
          const parsed = v.split(" ").map(a => a.trim()).filter(a => a.length > 0)
          return {
            sha: parsed[0].substring(0, 7),
            tag: parsed[1].substring("refs/tags/".length)
          }
        })

      return formattedList
    }

    private deleteOldDptTags = (workDir: string, tags: Array<TagInfo>, commitSha: string) => {
      const currentTags = tags.filter(t => t.sha === commitSha)
      logger.info("deleteOldDptTags(): %s", JSON.stringify(currentTags, null, 2))

      if (currentTags.length == 0) return

      // we found some tags at the current commit sha
      for (let tagInfo of currentTags) {
        if (tagInfo.tag == `dpt-fail-${commitSha}` || tagInfo.tag == `dpt-pass-${ commitSha }`) {
          // we found DPT tag at the current commit sha, lets remove it
          logger.info("deleting tag: %s at %s", tagInfo.tag, tagInfo.sha)
          NodeShell.execSync(`${ this.config.appRootDir }/scripts/git-tags.sh ${ this.config.dryRun } delete-tag ${ workDir } ${ tagInfo.tag }`)
        }
      }
    }

    executeActions = async (report: TestReport) => {
      logger.info("")
      logger.info("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -")
      logger.info("Git tagging module is processing the report: \"%s\"", report.name)
      logger.info("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -")

      const appRootDir = this.config.appRootDir

      const processWhenFailed = this.config.testFailActions.includes(ActionType.TAG_GIT_REPOSITORY)
      const processWhenPassed = this.config.testPassActions.includes(ActionType.TAG_GIT_REPOSITORY)
      if (!processWhenFailed && !processWhenPassed) {
        logger.info("No action is required from git-tag/GitTaggingService module")
        return
      }

      const workDir = `${ appRootDir }/${ Date.now() }`
      const commitSha = this.readCommitSha(workDir)
      const tagsList = this.getCurrentTags(workDir)

      this.deleteOldDptTags(workDir, tagsList, commitSha)

      // ok, now the repo is clean from the previous runs. Lets just tag it based on test results

      const isFailure = didTestFail(report)
      const newTagName = `dpt-${ isFailure ? 'fail' : 'pass' }-${ commitSha }`

      if (isFailure && processWhenFailed || !isFailure && processWhenPassed) {
        logger.info("Tagging the repository with tag %s", newTagName)
        NodeShell.execSync(`${ this.config.appRootDir }/scripts/git-tags.sh ${ this.config.dryRun } add-tag ${ workDir } ${ newTagName }`)
      }
    }
}