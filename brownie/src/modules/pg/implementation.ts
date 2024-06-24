import pg, { PoolConfig } from "pg"

import { logger } from "../../logger.js"

import { Config } from "../../config.js"
import { PgConfig } from "./config.js"
import { ResourceStatus, evaluateResource } from "../../utils.js"

export const clean = async (moduleName: string, config: Config, pgConfig: PgConfig) => {
  logger.info("%s.clean(): Cleaning old databases...", moduleName)

  let cleanedCount = 0
  const pgClient = new pg.Client({
    user: pgConfig.username,
    database: pgConfig.database,
    password: pgConfig.password,
    port: pgConfig.port,
    host: pgConfig.host,
    min: 1
  } as PoolConfig)

  await pgClient.connect()
  try {
    const result = await pgClient.query({
      name: "select-databases",
      text: "SELECT d.datname as database FROM pg_catalog.pg_database d WHERE d.datname like $1 ORDER BY d.datname",
      values: ["%pit%"]
    })
    for (let row of result?.rows) {
      const dbname = row.database

      try {
        const status = evaluateResource(dbname, config.timestampPattern, new Date(), config.retentionMinutes)
        if (status === ResourceStatus.SKIP || status === ResourceStatus.RETAIN) continue

      } catch (e) {
        logger.error("%s.clean(): Unable to evaluate database '%s'. Error: %s", moduleName, dbname, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }

      try {
        logger.info("%s.clean(): Deleting the expired database: %s", moduleName, dbname)

        if (config.dryRun) {
          logger.info("%s.clean(): Database has NOT been dropped (dry run mode): %s", moduleName, dbname)
        } else {
          await pgClient.query({
            name: `drop-db-${ dbname }`,
            text: `DROP DATABASE "${ dbname }"`
          })

          logger.info("%s.clean(): Database has been dropped: %s", moduleName, dbname)
        }
        cleanedCount++

        const sleep = new Promise(resolve => setTimeout(resolve, 2_000))
        await sleep

      } catch (e) {
        logger.error("%s.clean(): Unable to drop database '%s'. Error: %s", moduleName, dbname, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }
    }
  } finally {
    pgClient?.end()
  }

  if (cleanedCount > 0) {
    logger.info("%s.clean(): Dropped %s database%s", moduleName, cleanedCount, cleanedCount > 1 ? "s" : "")
  } else {
    logger.info("%s.clean(): There are no databases to clean", moduleName)
  }
  logger.info("\n\n")
}