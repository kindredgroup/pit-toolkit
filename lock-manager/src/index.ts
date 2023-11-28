import express, { Express, Request, Response } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"

const DEFAULT_PORT = 60001

const main = async () => {
  const app: Express = express()
  app.get('/', (_req: Request, res: Response) => {
    res.send({
      app: "lock-manager",
      time: new Date()
    })
  })

  app.post('/locks/acquire', (_req: Request, res: Response) => {
    res.send()
  })

  app.post('/locks/release', (_req: Request, res: Response) => {
    res.send()
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