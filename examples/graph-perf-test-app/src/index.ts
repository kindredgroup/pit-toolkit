import express, { Express } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"
import { WebService } from './web-api/service.js'

const DEFAULT_PORT = 62003

const main = async () => {
  const app: Express = express()
  app.use(express.json())

  const _service = new WebService(app)

  logger.info("Test app will be connecting to: %s", process.env["TARGET_SERVICE_URL"])

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