import express, { Express } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"
import { ApiRoutes } from './api-routes.js'
import { PostgresDb } from './db/pg.js'

let db = new PostgresDb()

const DEFAULT_PORT = 60001

const main = async () => {
  const app: Express = express()
  const jsonParser = express.json()

  // add more middleware here
  app.use(jsonParser)

  const _apiRoutes = new ApiRoutes(app, db)

  const servicePort = ConfigReader.getParam("--container-port", DEFAULT_PORT)

  app.listen(servicePort, () => {
    logger.info("HTTP server is running at http://localhost:%d", servicePort)
  })
}

// TODO Test DB connections on error
main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
    db.disconnect()
  })