import {Express, Request, Response} from "express";
import LockFactory from "../lock_operations.js";
import {LockAcquireObject, LockKeepAlive} from "../db/db.js";
import {logger} from "../logger.js";
import { PostgresDb } from "../db/pg.js";


export class ApiRoutes {
    
    private storage = LockFactory.instantiate();
    private db = new PostgresDb();

  constructor(readonly app: Express) {
    app.get("/", (_req: Request, res: Response) => this.checkAPI(_req, res));

    app.post("/lock/acquire", async (_req: Request, res: Response) =>
      this.acquire(_req, res)
    );
    app.post("/lock/keep-alive", async (_req: Request, res: Response) =>
      this.keepAlive(_req, res)
    );

    app.post("/lock/release", async (_req: Request, res: Response) =>
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
    try {
      let keysSaved = await this.storage.acquire(locks, this.db);
      res.status(200).send(keysSaved);
    } catch (error) {
      logger.error("error", error);

      res.status(409).send(error.message);
    }
  }

  private async keepAlive(req: Request, res: Response) {
    let locks = req.body as LockKeepAlive;
    try {
      let keysSaved = await this.storage.keepAlive(locks, this.db);
      res.status(200).send(keysSaved);
    } catch (error) {
      logger.error("error", error);

      res.status(409).send(error.message);
    }
  }
  private async release(req: Request, res: Response) {
    let lockIds = req.body as Array<String>;
    try {
      let keyRemoved = await this.storage.release(lockIds, this.db);
      res.status(200).send(keyRemoved);
    } catch (error) {
      logger.error("error", error);

      res.status(400).send(error.message);
    }
  }
}
