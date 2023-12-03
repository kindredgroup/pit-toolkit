import express, { Express, Request, Response } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"
import LockFactory from './lock_operations.js'
import { PostgresDb } from './db/pg.js'
import { LockAcquireObject, LockKeepAlive } from './db/db.js'
import * as Shell from "child_process"


const DEFAULT_PORT = 60001

const db = new PostgresDb();
const main = async () => {
  const app: Express = express()
  const jsonParser = express.json()
  
  // add more middleware here
  app.use(jsonParser)

  
  app.get('/', (_req: Request, res: Response) => {
    res.send({
      app: "lock-manager",
      time: new Date()
    })
  })

  let storage = LockFactory.instantiate();
  app.post('/lock/acquire', async (_req: Request, res: Response) => {
    let locks = _req.body as LockAcquireObject ;
    try {
      let keysSaved  = await storage.acquire(locks, db);
      res.status(200).send(keysSaved);
    } catch (error) {
      console.log("error", error);
      
      res.status(409).send(error.message)
    }
 
  })
  app.post('/lock/keep-alive', async (_req: Request, res: Response) => {
    let locksObj = _req.body as  LockKeepAlive;
   
    try {
      let keysSaved  = await storage.keepAlive(locksObj, db);
      res.status(200).send(keysSaved);
    } catch (error) {
      logger.error("error", error);

      res.status(409).send(error.message)
    }
 
  })

  app.post('/lock/release', async (_req: Request, res: Response) => {
    let lockIds = _req.body as  Array<String>;
    try {
      let keyRemoved  = await storage.release(lockIds, db);
      res.status(200).send(keyRemoved);
    } catch (error) {
      logger.error("error", error);

      res.status(400).send(error.message)
    }
    
  })
  Shell.execSync('npm run migrate:up')

  const servicePort = ConfigReader.getParam("--service-port", DEFAULT_PORT)
  // Shell.execSync('make withenv RECIPE=dev.migrate.up')


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