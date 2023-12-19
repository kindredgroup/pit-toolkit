import {Express, Request, Response} from "express";
import LockFactory from "../lock-operations.js";
import {Db, LockAcquireObject, LockKeepAlive} from "../db/db.js";
import {logger} from "../logger.js";

export class ApiRoutes {
    
  private operations = LockFactory.instantiate();

  constructor(readonly app: Express, readonly db: Db) {
    app.get("/", (_req: Request, res: Response) => this.checkAPI(_req, res));

    app.post("/locks/acquire", async (_req: Request, res: Response) =>
      this.acquire(_req, res)
    );
    app.post("/locks/keep-alive", async (_req: Request, res: Response) =>
      this.keepAlive(_req, res)
    );

    app.post("/locks/release", async (_req: Request, res: Response) =>
      this.release(_req, res)
    );
    
  }

  private async checkAPI(req: Request, res: Response) {
    res.send({
      app: "lock-manager",
      time: new Date(),
    });
  }

  private async acquire(req: Request, res: Response) {
    let locks = req.body as LockAcquireObject;
    logger.info("api-route.acquire():locks %s", locks);
    
    try {
      let keysSaved = await this.operations.acquire(locks, this.db);
      res.status(200).send(keysSaved);
    } catch (error) {
      logger.error("api-route.acquire():error", error);
      if (error.message.includes("duplicate key value violates unique constraint")) {
        res.status(409).send(error.message);
      }else{

        res.status(400).send(error.message);
      }
    }
  }

  private async keepAlive(req: Request, res: Response) {
    let locks = req.body as LockKeepAlive;
    try {
      let keysSaved = await this.operations.keepAlive(locks, this.db);
      res.status(200).send(keysSaved);
    } catch (error) {
      logger.error("api-route.keepAlive()", error);

      res.status(400).send(error.message);
    }
  }
  private async release(req: Request, res: Response) {
    let lockIds = req.body as Array<String>;
    try {
      let keyRemoved = await this.operations.release(lockIds, this.db);
      res.status(200).send(keyRemoved);
    } catch (error) {
      logger.error("api-route.release()", error);

      res.status(400).send(error.message);
    }
  }
}
