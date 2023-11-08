import express, { Express, Request, Response } from 'express'

import { logger } from "./logger.js"

const DEFAULT_PORT = 62001

const getParam = (name: String, defaultValue: string | number): string | number => {
  if (process.argv.length > 2) {
    for (let i = 2; i + 1 < process.argv.length; i++) {
      if (process.argv[i].toLowerCase() !== name) continue
      if (typeof(defaultValue) == 'string') return process.argv[i + 1]

      const numValue = parseInt(process.argv[i + 1])
      if (isNaN(numValue)) {
        logger.warn("Cannot parse parameter '%s' into number. Given value: '%s'. Using default: %s.", name, process.argv[i + 1], defaultValue)
        return defaultValue
      }

      return numValue
    }
  }

  const envName = name.replaceAll("--", "").replaceAll("-", "_").toUpperCase()
  logger.info("Cannot find parameter '%s'. Reading environment varialbe: %s", name, envName)

  const envValue = process.env[envName]
  if (!envValue) return defaultValue

  if (typeof(defaultValue) == 'string') return envValue + ""
  const numValue = parseInt(envValue)
  if (isNaN(numValue)) {
    logger.warn("Cannot parse environemnt variable '%s' into number. Given value: '%s'. Using default: %s.", envName, envValue, defaultValue)
    return defaultValue
  }

  return numValue
}

const main = async () => {
  const app: Express = express()
  app.get('/time', (_req: Request, res: Response) => {
    res.send({
      app: "graph-node-1",
      time: new Date()
    })
  })

  const servicePort = getParam("--service-port", DEFAULT_PORT)
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