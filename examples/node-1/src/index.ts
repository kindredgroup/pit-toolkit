import express, { Express, Request, Response } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"

const DEFAULT_PORT = 62001

const main = async () => {
  const app: Express = express()
  app.get('/time', (_req: Request, res: Response) => {
    res.send({
      app: "node-1",
      time: new Date()
    })
  })

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