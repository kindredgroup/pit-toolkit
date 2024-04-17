import pg, { PoolConfig } from "pg"

import { logger } from "./logger.js"
import { readParams } from "./bootstrap.js"
import * as cfg from "./config.js"
import { ResourceStatus, evaluateResource } from "./utils.js"
import Kafkajs from "kafkajs"
import type { KafkaConfig as KafkaJsConfig, SASLOptions } from "kafkajs"

const main = async () => {
  const config: cfg.Config = readParams()

  const cleanedConfig = {
    ...config,
    pg:    { ...config.pg, password: "*** hidden ***" } as cfg.PgConfig,
    kafka: { ...config.kafka, password: "*** hidden ***" } as cfg.KafkaConfig
  } as cfg.Config

  logger.info("main(), Parsed configuration: \n%s", JSON.stringify({ ...cleanedConfig, timestampPattern: config.timestampPattern.toString() }, null, 2))

  logger.info("Cleaning old databases...")
  const cleanedDbsCount = await cleanOldDatabases(config)
  if (cleanedDbsCount > 0) {
    logger.info("Dropped %s database%s", cleanedDbsCount, cleanedDbsCount > 1 ? "s" : "")
  } else {
    logger.info("There are no databases to clean")
  }
  logger.info("\n\n")

  logger.info("Cleaning kafka topics...")
  const cleanedTopicsCount = await cleanTopics(config)
  if (cleanedTopicsCount > 0) {
    logger.info("Deleted %s topics%s", cleanedTopicsCount, cleanedTopicsCount > 1 ? "s" : "")
  } else {
    logger.info("There are no topics to delete")
  }
}

const cleanOldDatabases = async (config: cfg.Config): Promise<number> => {
  let cleanedCount = 0
  const pgClient = new pg.Client({
    user: config.pg.username,
    database: config.pg.database,
    password: config.pg.password,
    port: config.pg.port,
    host: config.pg.host,
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
        logger.error("Unable to evaluate database '%s'. Error: %s", dbname, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }

      try {
        logger.info("cleanOldDatabases(): Deleting the expired database: %s", dbname)

        if (config.dryRun) {
          logger.info("cleanOldDatabases(): Database has NOT been dropped (dry run mode): %s", dbname)
        } else {
          await pgClient.query({
            name: `drop-db-${ dbname }`,
            text: `DROP DATABASE "${ dbname }"`
          })

          logger.info("cleanOldDatabases(): Database has been dropped: %s", dbname)
        }
        cleanedCount++

        const sleep = new Promise(resolve => setTimeout(resolve, 2_000))
        await sleep

      } catch (e) {
        logger.error("cleanOldDatabases(): Unable to drop database '%s'. Error: %s", dbname, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }
    }
  } finally {
    pgClient?.end()
  }

  return cleanedCount
}

const cleanTopics = async (config: cfg.Config): Promise<number> => {
  let cleanedCount = 0

  const kafkaConfig: KafkaJsConfig = {
    brokers: config.kafka.brokers,
    clientId: config.kafka.clientId
  }

  if (config.kafka.username) {
    const { username, password } = config.kafka
    kafkaConfig.sasl = {
      mechanism: (config.kafka.saslMechanism ? config.kafka.saslMechanism : "scram-sha-512"),
      username,
      password
    } as SASLOptions
  }

  logger.info("cleanTopics(): Connecting to kafka server...")
  const kafka = new Kafkajs.Kafka(kafkaConfig)
  const kafkaAdmin = kafka.admin()
  await kafkaAdmin.connect()
  logger.info("cleanTopics(): Connected")

  try {
    const topics = (await kafkaAdmin.listTopics()).filter(name => !name.startsWith("_"))
    for (let topicName of topics) {
      try {
        const status = evaluateResource(topicName, config.timestampPattern, new Date(), config.retentionMinutes)
        if (status === ResourceStatus.SKIP || status === ResourceStatus.RETAIN) continue

      } catch (e) {
        logger.error("cleanTopics(): Unable to evaluate topic '%s'. Error: %s", topicName, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }

      try {
        logger.info("cleanTopics(): Deleting the expired topic: %s", topicName)
        if (config.dryRun) {
          logger.info("cleanTopics(): Topic has NOT been deleted (dry run mode): %s", topicName)
        } else {
          await kafkaAdmin.deleteTopics({ topics: [ topicName ] })

          logger.info("cleanTopics(): Topic has been deleted: %s", topicName)
        }
        cleanedCount++

        const sleep = new Promise(resolve => setTimeout(resolve, 2_000))
        await sleep

      } catch (e) {
        logger.error("cleanTopics(): Unable to delete topic '%s'. Error: %s", topicName, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }
    }
  } finally {
    await kafkaAdmin.disconnect()
  }

  return cleanedCount
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })