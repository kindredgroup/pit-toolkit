import * as fs from "fs"

import { TestOutcomeType, TestReport } from "../report/schema-v1.js"
import { PublisherConfig } from "./config.js"
import { logger } from "../logger.js"
import { ActionType, Config } from "../config.js"
import { didTestFail } from "../report/utils.js"

type BodySchema = {
  type: string,
  inlines: { type: string, text: string, weight?: string, color?: string }[],
}
type ActionSchema = { type: string, title: string, url: string }
type PostSchema = { body: BodySchema[], actions?: ActionSchema[] }

export class TeamsPublisher {
  static init(config: PublisherConfig, appRoot: string, dryRun: boolean): TeamsPublisher {
    const template = fs.readFileSync(`${appRoot}/dist/src/teams/post-template.json`, "utf8")
    return new TeamsPublisher(config, template, dryRun)
  }

  constructor(readonly config: PublisherConfig, readonly template: string, readonly dryRun: boolean) {}

  private formatTime(startTime: Date, endTime: Date): string {
    const fmt = (d: Date): string =>  {
      let value = `${d}`
      // trim millis
      const dot = value.indexOf(".")
      if (dot !== -1) {
        value = `${value.substring(0, dot)}${value.substring(dot + 4)}`
      }
      return `{{DATE(${value}, COMPACT)}} {{TIME(${value})}}`
    }
    return `${ fmt(startTime) } - ${ fmt(endTime) }`
  }

  private generatePostContent = (report: TestReport): PostSchema => {
    const body: BodySchema[] = [
      {
        type: "RichTextBlock",
        inlines: [
          { type: "TextRun", text: "Test Suite: " },
          { type: "TextRun", text: `${ report.name }`, weight: "bolder" },
        ]
      },
      {
        type: "RichTextBlock",
        inlines: [
          { type: "TextRun", text: "Execution time: ", weight: "lighter" },
          { type: "TextRun", text: this.formatTime(report.startTime, report.endTime), weight: "lighter" }
        ]
      }
    ]

    for (let scenario of report.scenarios) {
      body.push(
        {
          type: "RichTextBlock",
          inlines: [
            { type: "TextRun", text: "Scenario: " },
            { type: "TextRun", text: `${ scenario.name }`, weight: "bolder" }
          ]
        }
      )
      body.push(
        {
          type: "RichTextBlock",
          inlines: [
            { type: "TextRun", text: "Execution time: " },
            { type: "TextRun", text: this.formatTime(scenario.startTime, scenario.endTime) }
          ]
        }
      )

      for (let stream of scenario.streams) {
        body.push(
          {
            type: "RichTextBlock",
            inlines: [
              { type: "TextRun", text: "Stream: " },
              { type: "TextRun", text: `${ stream.name } `, weight: "bolder" },
              { type: "TextRun", text: ", Outcome " },
              { type: "TextRun", text: `${ stream.outcome }`, color: (stream.outcome === TestOutcomeType.FAIL ? "warning" : "good"), weight: "bolder" }
            ]
          }
        )
      }

      for (let comp of scenario.components) {
        body.push(
          {
            type: "RichTextBlock",
            inlines: [
              { type: "TextRun", text: "Component: " },
              { type: "TextRun", text: comp.name, weight: "bolder" },
              { type: "TextRun", text: ` (${ comp.commitVersion })` }
            ]
          }
        )
      }
    }

    const buildUrl = process.env['BUILD_URL']
    if (buildUrl) {
      let buildNr = process.env['BUILD_DISPLAY_NAME']
      buildNr = buildNr ? `: ${buildNr}` : ''
      return { body, actions: [ { type: "Action.OpenUrl", title: `Build Details${ buildNr }`, url: buildUrl } ] }
    } else {
      return { body }
    }
  }

  executeActions = async (config: Config, report: TestReport) => {
    logger.info("")
    logger.info("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -")
    logger.info("Teams publisher module is processing the report: \"%s\"", report.name)
    logger.info("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -")

    const isFailure = didTestFail(report)
    if (isFailure && !config.testFailActions.includes(ActionType.POST_TO_TEAMS)) {
      logger.info("Test has failed: \"%s\". No action is required from teams/TeamsPublisher module.", report.name)
      return
    }

    if (!isFailure && !config.testPassActions.includes(ActionType.POST_TO_TEAMS)) {
      logger.info("Test has passed: \"%s\". No action is required from teams/TeamsPublisher module", report.name)
      return
    }

    const postData = JSON.parse(this.template)
    const bodyAndActions = this.generatePostContent(report)
    postData.attachments[0].content.body = bodyAndActions.body
    if (bodyAndActions.actions) {
      postData.attachments[0].content.actions = bodyAndActions.actions
    }

    if (this.dryRun) {
      logger.info("DRY RUN mode is ON. The following message will not be posted to Teams\n%s", JSON.stringify(postData, null, 2))
      return
    }

    logger.info("Posting into teams: \n%s", JSON.stringify(postData, null, 2))
    const httpResponse = await fetch(
      this.config.webhookUrl,
      { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify(postData) }
    )

    if (!httpResponse.ok) {
      throw new Error(`Unable to post message to Teams. HTTP statusText: ${ httpResponse.statusText }`)
    }

    logger.info("Message successfully posted to Teams")
  }
}