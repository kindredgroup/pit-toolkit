import { logger } from "./logger.js"

export async function* generateAtRate<T>(throughput: number, durationSec: number, newItemFactory: (id:string) => T) {
  let itemsCount = 0
  const perItemTimeMs = 1 / throughput * 1000; // Time between data items in milliseconds
  const totalRecordsToProduce = durationSec * throughput // Total number of records for test

  const startTimeMs = Date.now();
  let nextItemTimeMs = startTimeMs;

  for (let i = 0; i < totalRecordsToProduce; i++) {
    const dataItem = newItemFactory(`${ itemsCount + 1 }`)
    itemsCount++
    yield dataItem;

    const now = Date.now();
    const delay = nextItemTimeMs - now;
    if (delay > 0) {
      await sleep(delay);
    }
    nextItemTimeMs += perItemTimeMs;
  }

  logger.info("Load generator has finished. Generated items count: %s", itemsCount)
}

const sleep = (time: number) => new Promise(resolve => setTimeout(resolve, time))