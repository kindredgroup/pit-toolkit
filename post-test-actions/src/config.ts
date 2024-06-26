import { GitConfig } from "./git-tag/config.js"
import { PublisherConfig } from "./teams/config.js"

export enum ActionType {
  POST_TO_TEAMS = 'POST_TO_TEAMS',
  TAG_GIT_REPOSITORY = 'TAG_GIT_REPOSITORY'
}

export class Config {
  static PARAM_TEST_PASS_ACTIONS = "--test-pass-actions"
  static PARAM_TEST_FAIL_ACTIONS = "--test-fail-actions"
  static PARAM_DRY_RUN = "--dry-run"
  static PARAM_WORKSPACE = "--workspace"
  static PARAM_EXIT_CODE = "--exit-code-on-test-failure"
  static PARAM_APP_ROOT = "--app-root-dir"

  static parseActions = (csvValues: string): Array<ActionType> => {
    if (!csvValues) return []

    return csvValues
      .split(",")
      .map(t => t.trim().toUpperCase())
      .map(t => t.replaceAll("-", "_"))
      .filter(t => t.length > 0)
      .map(t => t as keyof typeof ActionType)
      .map(t => t as any as ActionType)
  }

  constructor(
    readonly testPassActions: ActionType[],
    readonly testFailActions: ActionType[],
    readonly dryRun: boolean,
    readonly workspaceDir: string,
    readonly exitCode: number,
    readonly appRootDir: string,
    readonly teamsConfig?: PublisherConfig,
    readonly gitConfig?: GitConfig
  ) {}
}
