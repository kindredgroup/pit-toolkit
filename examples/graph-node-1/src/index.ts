import express, { Express, Request, Response } from 'express'

import { logger } from "./logger.js"

const PORT = 62001

const main = async () => {
  const app: Express = express()
  app.get('/time', (_req: Request, res: Response) => {
    res.send({
      app: "graph-node-1",
      time: new Date()
    })
  })

  app.listen(PORT, () => {
    logger.info("HTTP server is running at http://localhost:%d", PORT);
  })
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })