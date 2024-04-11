import { logger } from "./utls/logger.js"
import * as hdr from "hdr-histogram-js"

const dataSamples = [46,13,25,45,35,13,27,16,36,48,30,17,36,36,15,38,5,25,21,31,22,16,17,22,35,38,33,29,25,9,23,17,5,31,38,35,42,42,21,31,41,17,42,45,30,10,40,31,28,10,34,34,5,39,21,12,46,47,12,26,11,38,43,21,32,30,34,8,20,27,19,13,42,27,30,31,11,38,6,16,46,42,33,34,9,41,21,33,13,8,38,41,9,32,46,48,34,11,46,26]

const main = async () => {

  const histogram = hdr.build();
  for (let sample of dataSamples) {
    histogram.recordValue(sample)
  }

  logger.info("Stats is ready")
  logger.info("Count: %s", histogram.totalCount)
  logger.info("Max  : %s (ms)", histogram.maxValue)
  logger.info("Min  : %s (ms)", histogram.minNonZeroValue)
  logger.info("p05  : %s (ms)", histogram.getValueAtPercentile(5))
  logger.info("p10  : %s (ms)", histogram.getValueAtPercentile(10))
  logger.info("p15  : %s (ms)", histogram.getValueAtPercentile(15))
  logger.info("p25  : %s (ms)", histogram.getValueAtPercentile(25))
  logger.info("p50  : %s (ms)", histogram.getValueAtPercentile(50))
  logger.info("p75  : %s (ms)", histogram.getValueAtPercentile(75))
  logger.info("p90  : %s (ms)", histogram.getValueAtPercentile(90))
  logger.info("p95  : %s (ms)", histogram.getValueAtPercentile(95))
  logger.info("p99  : %s (ms)", histogram.getValueAtPercentile(99))
  logger.info("p100 : %s (ms)", histogram.getValueAtPercentile(100))
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })