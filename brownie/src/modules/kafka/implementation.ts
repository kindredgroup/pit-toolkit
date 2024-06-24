import Kafkajs from "kafkajs"
import type { KafkaConfig as KafkaJsConfig, SASLOptions } from "kafkajs"

import { logger } from "../../logger.js"
import { Config } from "../../config.js"
import { ResourceStatus, evaluateResource } from "../../utils.js"
import { KafkaConfig } from "./config.js"

export const clean = async (moduleName: string, config: Config, moduleConfig: KafkaConfig) => {
  logger.info("%s.clean(): Cleaning kafka topics...", moduleName)

  let cleanedCount = 0

  const kafkaConfig: KafkaJsConfig = {
    brokers: moduleConfig.brokers,
    clientId: moduleConfig.clientId
  }

  if (moduleConfig.username) {
    const { username, password } = moduleConfig
    kafkaConfig.sasl = {
      mechanism: (moduleConfig.saslMechanism ? moduleConfig.saslMechanism : "scram-sha-512"),
      username,
      password
    } as SASLOptions
  }

  logger.info("%s.clean(): Connecting to kafka server...", moduleName)
  const kafka = new Kafkajs.Kafka(kafkaConfig)
  const kafkaAdmin = kafka.admin()
  await kafkaAdmin.connect()
  logger.info("%s.clean(): Connected", moduleName)

  try {
    const topics = (await kafkaAdmin.listTopics()).filter(name => !name.startsWith("_"))
    for (let topicName of topics) {
      try {
        const status = evaluateResource(topicName, config.timestampPattern, new Date(), config.retentionMinutes)
        if (status === ResourceStatus.SKIP || status === ResourceStatus.RETAIN) continue

      } catch (e) {
        logger.error("%s.clean():  Unable to evaluate topic '%s'. Error: %s", moduleName, topicName, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }

      try {
        logger.info("%s.clean(): Deleting the expired topic: %s", moduleName, topicName)
        if (config.dryRun) {
          logger.info("%s.clean(): Topic has NOT been deleted (dry run mode): %s", moduleName, topicName)
        } else {
          await kafkaAdmin.deleteTopics({ topics: [ topicName ] })

          logger.info("%s.clean(): Topic has been deleted: %s", moduleName, topicName)
        }
        cleanedCount++

        const sleep = new Promise(resolve => setTimeout(resolve, 2_000))
        await sleep

      } catch (e) {
        logger.error("%s.clean(): Unable to delete topic '%s'. Error: %s", moduleName, topicName, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }
    }
  } finally {
    await kafkaAdmin.disconnect()
  }

  if (cleanedCount > 0) {
    logger.info("%s.clean(): Deleted %s topics%s", moduleName, cleanedCount, cleanedCount > 1 ? "s" : "")
  } else {
    logger.info("%s.clean(): There are no topics to delete", moduleName)
  }
}