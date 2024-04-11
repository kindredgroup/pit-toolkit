import { logger } from "./utls/logger.js"

export const logItemAndSleep = async <T,> (sleepDurationMs: number, item: T) => {
  // logger.info("handling: %s", item)
  if (sleepDurationMs > 0) {
    await new Promise(resolve => setTimeout(resolve, sleepDurationMs))
  }
}