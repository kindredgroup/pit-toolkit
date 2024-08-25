import { Client, ClientOptions } from "@elastic/elasticsearch"
import { CatIndicesResponse } from "@elastic/elasticsearch/lib/api/types.js"
import { logger } from "../../logger.js"
import { Config } from "../../config.js"
import { ResourceStatus, evaluateResource } from "../../utils.js"
import { ElasticsearchConfig } from "./config.js"

export const clean = async (moduleName: string, config: Config, moduleConfig: ElasticsearchConfig) => {
  logger.info("%s.clean(): Cleaning Elasticsearch indices...", moduleName)

  let cleanedCount = 0

  const { brokerProtocol = "https", brokers, port, username, password } = moduleConfig

  const basicAuth: ClientOptions["auth"] = username && password ? { password, username } : undefined

  const nodes = brokers
    .split(",")
    .map((b) => b.trim())
    .map((hostname: string) => `${brokerProtocol}://${hostname}:${port}`)

  const client = new Client({
    auth: basicAuth,
    nodes: nodes as string[],
    tls: {
      rejectUnauthorized: false,
    },
  })

  logger.info("%s.clean(): Connecting to Elasticsearch server...", moduleName)

  try {
    await client.ping()
    logger.info("%s.clean(): Elasticsearch Connected", moduleName)
  } catch (e) {
    logger.error("%s.clean(): Unable to connect Elasticsearch. Error: %s", moduleName, e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    return
  }

  let indexRecords: CatIndicesResponse = []

  try {
    indexRecords = await client.cat.indices({ format: "json" })
  } catch (e) {
    logger.error("%s.clean(): Unable to fetch indices. Error: %s", moduleName, e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    return
  }

  for (const record of indexRecords) {
    const { index = "" } = record

    try {
      const status = evaluateResource(index, config.timestampPattern, new Date(), config.retentionMinutes)
      if (status !== ResourceStatus.CLEAN) continue
    } catch (e) {
      logger.error("%s.clean():  Unable to evaluate index '%s'. Error: %s", moduleName, index, e.message)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
    }

    try {
      logger.info("%s.clean(): Deleting the expired index: %s", moduleName, index)

      if (config.dryRun) {
        logger.info("%s.clean(): Index has NOT been deleted (dry run mode): %s", moduleName, index)
      } else {
        await client.indices.delete({ index })
        logger.info("%s.clean(): Index has been deleted: %s", moduleName, index)
      }
      cleanedCount++
      const sleep = new Promise((resolve) => setTimeout(resolve, 2_000))
      await sleep
    } catch (e) {
      logger.error("%s.clean(): Unable to delete index '%s'. Error: %s", moduleName, index, e.message)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
    }
  }

  if (cleanedCount > 0) {
    logger.info("%s.clean(): Deleted %s %s", moduleName, cleanedCount, cleanedCount > 1 ? "indices" : "index")
  } else {
    logger.info("%s.clean(): There is no index to delete", moduleName)
  }
}
