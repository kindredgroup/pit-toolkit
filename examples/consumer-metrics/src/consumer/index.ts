import { CONSUMER_GROUP, PRINT_PROGRESS_EVERY, TOPIC, kafkaClient } from "../core.js"
import { logger } from "../logger.js"

const main = async () => {
  logger.info("main(): Starting consumer...")

  const consumer = kafkaClient.consumer({
    groupId: CONSUMER_GROUP,
    readUncommitted: false
  })

  await consumer.subscribe({ topics: [ TOPIC ] })

  let firstMessageTime = 0
  let recentMessageTime = 0
  let count = 0
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ message }) => {
      if (firstMessageTime == 0) firstMessageTime = Date.now()
      recentMessageTime = Date.now()
      count++
      if (count % PRINT_PROGRESS_EVERY == 0) logger.info("consuming: %s", message.value?.toString())
      await consumer.commitOffsets([ { topic: TOPIC, partition: 0, offset: `${ parseInt(message.offset) + 1 }` } ])
    }
  })

  // start metrics calculator
  setInterval(() => {
    if (Date.now() - recentMessageTime >= 30_000) {
      logger.info("auto resetting metrics...")
      firstMessageTime = 0
      recentMessageTime = 0
      count = 0
    }
    if (recentMessageTime) {
      logger.info("consumer rate: %s TPS", (count / ((recentMessageTime - firstMessageTime) / 1_000)).toFixed(2))
    }
  }, 5_000)
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    process.exit(1)
  })