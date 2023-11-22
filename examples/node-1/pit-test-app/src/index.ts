import express, { Express } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"
import { WebService } from "./web-api/service.js"

const DEFAULT_PORT = 62002
const TARGET_SERVICE_URL = "http://localhost"

const main = async () => {
  const app: Express = express()
  app.use(express.json())

  const targetServiceUrl = ConfigReader.getParam("--target-service-url", TARGET_SERVICE_URL)
  const _service = new WebService(app, targetServiceUrl as string)

  logger.info("Test app will be connecting to: %s", targetServiceUrl)

  const servicePort = ConfigReader.getParam("--service-port", DEFAULT_PORT)
  app.listen(servicePort, () => {
    logger.info("HTTP server is running at http://localhost:%d", servicePort);
  })
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })