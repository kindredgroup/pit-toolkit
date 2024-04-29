import * as fs from "fs"

import { Config as BrownieConfig } from "../config.js"
import { logger } from "../logger.js"

export const HNC_PARENT_ANNOTATION = "hnc.x-k8s.io/subnamespace-of"
export interface ChildNamespace {
  metadata: {
    creationTimestamp: string,
    name: string,
    annotations: Array<string>
  }
}

export class Config {
  constructor(
    readonly dryRun: boolean,
    readonly nsList: Array<ChildNamespace>,
    readonly retentionMinutes: number,
  ) {}
}

export const loadConfig = (params: Map<string, string>): Config => {
  const dryRunRaw = params.get(BrownieConfig.PARAM_DRY_RUN)
  const nsDataFile = params.get("--ns-file")
  const retentionRaw = params.get(BrownieConfig.PARAM_RETENTION_PERIOD)

  const nsListRaw = fs.readFileSync(`${ nsDataFile }`).toString("utf-8")
  let nsList: Array<ChildNamespace> = null
  try {
    nsList = JSON.parse(nsListRaw)
  } catch (e) {
    logger.warn("loadConfig(): Could not parse the list of namespaces:\n%s", nsListRaw)
    throw new Error(`Unable to parse raw list of namespaces in '${ nsDataFile }'`, { cause: e })
  }

  return new Config(
    "false" !== dryRunRaw.toLowerCase(),
    nsList,
    BrownieConfig.parseRetention(retentionRaw)
  )
}