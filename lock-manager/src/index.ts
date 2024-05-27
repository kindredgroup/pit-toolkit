import express, { Express } from 'express'
import swaggerUi from 'swagger-ui-express'

import * as fs from "fs"
import YAML from "yaml"

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
  const oasFilePath = new URL(" ", import.meta.url).pathname
  try {
    await fs.promises.access(oasFilePath, fs.constants.R_OK)
  } catch (e) {
    throw new Error(`There is no OAS schema file or it is not readable. File: "${ oasFilePath }"`, { cause: e })
  }
  const oasSchema = YAML.parse(fs.readFileSync(oasFilePath, "utf8"))
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(oasSchema));

  const servicePort = ConfigReader.getConfigParam("--container-port", DEFAULT_PORT)

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