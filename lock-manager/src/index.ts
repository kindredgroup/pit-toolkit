import express, { Express, Request, Response } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"
import LockFactory from './acquireLock.js'
import { PostgresDb } from './db/pg.js'
import { LockManagerDTO } from './db/db.js'

const DEFAULT_PORT = 60001

const db = new PostgresDb();

const main = async () => {
  // instt_db()
  const app: Express = express()
  const jsonParser = express.json()
  // only supported json parser
  app.use(jsonParser)

  
  app.get('/', (_req: Request, res: Response) => {
    res.send({
      app: "lock-manager",
      time: new Date()
    })
  })

  let storage = LockFactory.instantiate('db');
  app.post('/locks/acquire', async (_req: Request, res: Response) => {
    let locks = _req.body as Array<LockManagerDTO> ;
    //TODO parse the query params to LockManagerDTO
    try {
      let keysSaved  = await storage.acquire(locks as any, db);
      res.status(200).send(keysSaved);
    } catch (error) {

      res.status(409).send(error.message)
    }
 
  })

  app.post('/locks/release', async (_req: Request, res: Response) => {
    let lockKeys = _req.body as  Array<String>;
    try {
      let keyRemoved  = await storage.release(lockKeys, db);
      res.status(200).send(keyRemoved);
    } catch (error) {

      res.status(400).send(error.message)
    }
    
  })

  const servicePort = ConfigReader.getParam("--service-port", DEFAULT_PORT)
  app.listen(servicePort, () => {
    logger.info("HTTP server is running at http://localhost:%d", servicePort);
  })
}

// TODO Test DB connections on error
main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    db.disconnect();
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })