import express, { Express, Request, Response } from 'express'

import { logger } from "./logger.js"
import * as ConfigReader from "./configuration.js"
import ScyllaManager, { DbConfig, GetTaskModel, TaskStatus } from "scylla_pg_client"
import {v4 as uuid} from 'uuid';

const DEFAULT_PORT = 62001

const main = async () => {
  const app: Express = express()
  
  const dbConfig:DbConfig = {
    pgHost: "localhost",
    pgPort: 5432,
    pgUser: "postgres",
    pgPassword: "postgres",
    pgDatabase: "scylla",
    pgPoolSize: 10
  }
  const scyllaManager =  await ScyllaManager.initiate(dbConfig)
  

  app.get('/addTask', (_req: Request, res: Response) => {
    scyllaManager.addTask({
      rn: uuid(),
      queue: "test",
      spec: {},
      priority: 1
    }).then((task) => {
      res.send(task)
    }).catch((err) => {
      console.log(err)
      res.send(err)
    })
    
  })
  app.post('/getTasks', (_req: Request, res: Response) => {
    const req = _req.body;
    const task:GetTaskModel = {
      status: TaskStatus.ready,
      queue: "test",
      limit: 100
    }
    scyllaManager.getTasks(task).then((task) => {
      res.send(task)
    }).catch((err) => {
      console.log(err)
      res.send(err)
    })
    
  })
  app.post('/leaseNTask', (_req: Request, res: Response) => {
    const req = _req.body
    const queue = "test"
    const limit = 100
    const worker = "test-app"

    
    scyllaManager.leaseNTasks(queue,limit,worker).then((task) => {
      res.send(task)
    }).catch((err) => { 
      console.log(err)
      res.send(err)
    })
    
  })

  app.post('/heartBeatTask', (_req: Request, res: Response) => {
    const req = _req.body
    const rn = req.rn
    const progress = req.progress
    const worker = "test-app"
    scyllaManager.heartBeatTask(rn,progress).then((task) => {
      res.send(task)
    }).catch((err) => {
      console.log(err)
      res.send(err)
    })
    
  })

  app.post('/cancelTask', (_req: Request, res: Response) => {
    const req = _req.body
    const rn = req.rn
    scyllaManager.cancelTask(rn).then((task) => {
      res.send(task)
    }).catch((err) => {
      console.log(err)
      res.send(err)
    })
    
  })

  app.post('/completeTask', (_req: Request, res: Response) => {
    const req = _req.body
    const rn = req.rn
    scyllaManager.completeTask(rn).then((task) => {
      res.send(task)
    }).catch((err) => {
      console.log(err)
      res.send(err)
    })
    
  })

  const _service = new ScyllaAPIRoute(app, targetServiceUrl as string)

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