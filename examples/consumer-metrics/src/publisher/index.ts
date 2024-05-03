import { Admin, Producer } from "kafkajs"
import * as hdr from "hdr-histogram-js"

import { CONSUMER_GROUP, PRINT_PROGRESS_EVERY, TOPIC, kafkaClient } from "../core.js"
import { logger } from "../logger.js"

const OFFSET_MONITOR_FREQUENCY_SECONDS = 15
const MESSAGES_COUNT = 1_000_000
const consumerMetrics = hdr.build()

const main = async () => {
  logger.info("main(): Starting producer...")

  const producer = kafkaClient.producer()
  await producer.connect()

  const admin = kafkaClient.admin()
  await admin.connect()

  const initialOffset = await getOffsetValue(admin)
  const expectedOffset = Math.max(0, initialOffset) + MESSAGES_COUNT

  let sentMessages = 0
  logger.info("Initial offset: %s, expected offset: %s", initialOffset, expectedOffset)
  setTimeout(async() => {
    await startTest(producer, sent => { sentMessages = sent })
    await producer.disconnect()
  }, 0)

  setTimeout(async() => {
    const timer = await startMonitor(admin, async recentlyFetchedOffset => {
      if (recentlyFetchedOffset < expectedOffset) return
      if (recentlyFetchedOffset > expectedOffset && sentMessages < MESSAGES_COUNT) {
        logger.warn("Incorrect value of fetched offset: %s. Current messages: %s. Approx expected offset is: %s", recentlyFetchedOffset, sentMessages,  sentMessages + initialOffset)
        return
      }
      consumerMetrics.recordValue(Date.now())
      if (timer) {
        logger.info("stopping offset monitor....")
        clearInterval(timer)
      }
      await admin.disconnect()
      printMetrics()
    })
  }, 0)
}

const getOffsetValue = async(admin: Admin) => {
  const offsets = await admin.fetchOffsets({ groupId: CONSUMER_GROUP, topics: [ TOPIC ] })
  const offsetsArray = offsets.flatMap(({ partitions }) => {
    return partitions.map(({ offset }) => offset)
  })
  return offsetsArray.length > 0 ? parseInt(offsetsArray[0]) : 0
}

const startMonitor = async (admin: Admin, offsetCallback: (value: number) => Promise<void>) => {
  return setInterval(async () => {
    const offset = await getOffsetValue(admin)
    logger.info("fetched offset: %s", offset)
    await offsetCallback(offset)
  }, OFFSET_MONITOR_FREQUENCY_SECONDS * 1_000)
}

const startTest = async (producer: Producer, publishCallback: (sent: number) => void) => {
  consumerMetrics.recordValue(Date.now())
  for (let i = 1; i <= MESSAGES_COUNT; i++) {
    await producer.send({
      topic: TOPIC,
      messages: [ { value: `Sample message: ${i}` } ],
    })
    publishCallback(i)
    if (i % PRINT_PROGRESS_EVERY == 0) logger.info("sent: %s", i)
  }
  logger.info("all messages have been published")
}

const printMetrics = () => {
  logger.info("Count     : %s", MESSAGES_COUNT)
  logger.info("Throughput: %s (tps)", (MESSAGES_COUNT / ((consumerMetrics.maxValue - consumerMetrics.minNonZeroValue) / 1_000)).toFixed(2))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    process.exit(1)
  })