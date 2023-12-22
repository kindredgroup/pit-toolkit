import {Express, Request, Response} from "express";
import LockFactory from "../lock-operations.js";
import {Db, LockAcquireObject, LockKeepAlive, ReleaseLocks} from "../db/db.js";
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
      this.checkEmptyReqBody(locks,'acquire')
      this.checkEmptyString(locks.owner,'owner')
      this.checkEmptyString(locks?.lockId,'lockId')
      this.validateExpiryTime( locks.expiryInSec);
      let keysSaved = await this.operations.acquire(locks, this.db);
      res.status(200).send(keysSaved);
    } catch (error) {
      logger.error("api-route.acquire():error %s", error);
      if (error.message.includes("duplicate key value violates unique constraint")) {
        res.status(409).send(error.message);
      }else{

        res.status(400).send(error.message);
      }
    }
  }

  private async keepAlive(req: Request, res: Response) {
    let keepAliveObj = req.body as LockKeepAlive;
    logger.info("api-route.keepAlive(): req body  %s", keepAliveObj);
    let { lockIds, owner, expiryInSec} = keepAliveObj
    try {
      this.checkEmptyReqBody(keepAliveObj,'keepAlive')  
      this.validateLockIds(lockIds);
      this.validateExpiryTime( expiryInSec);
      this.checkEmptyString(owner,'owner')
      let keysSaved = await this.operations.keepAlive(keepAliveObj, this.db);
      res.status(200).send(keysSaved);
    } catch (error) {
      logger.error("api-route.keepAlive() %s", error);

      res.status(400).send(error.message);
    }
  }
  private async release(req: Request, res: Response) {
    let locksRelease = req.body as ReleaseLocks;
    logger.info("api-route.release(): req body  %s", locksRelease);
    try {
      this.checkEmptyReqBody(locksRelease,'release')
      this.validateLockIds(locksRelease.lockIds);
      this.checkEmptyString(locksRelease?.owner,'owner')
      let keyRemoved = await this.operations.release(locksRelease, this.db);
      res.status(200).send(keyRemoved);
    } catch (error) {
      logger.error("api-route.release() %s", error);

      res.status(400).send(error.message);
    }
  }

  // express-validator can be used to validate the request body
  // right now using custom validation

  private checkEmptyReqBody(reqBody: any, apiName: string) {
    if(reqBody === undefined || reqBody === null || typeof reqBody !== "object" || Object.keys(reqBody).length === 0){
      throw new Error(
       `${apiName} request body is a non empty object`
      );
    }

  }


  private checkEmptyString(str: String, field: String) {
    if( str === undefined || str === null || str === "" || typeof str !== "string"){
      throw new Error(
       ` ${field} should be a non empty string field in request body`
      );
    }
  }

  private validateLockIds(lockIds: Array<String>) {
    logger.info("LockManager.validateLockIds(): %s", lockIds);
    if (!Array.isArray(lockIds) || lockIds?.length === 0) {
      throw new Error(
        "lockIds should be a non empty array in request body"
      );
    }
      lockIds?.forEach(lockId => this.checkEmptyString(lockId,'lockId'))
  }
  private validateExpiryTime(timeout: number) {
    logger.info("LockManager.validateTimeout(): %s", timeout);
    if (timeout === undefined || timeout === null){}
    else if (typeof timeout !== "number" || timeout < 0 || Number.isNaN(timeout)) {
      throw new Error(
        "timeout should be a valid number"
      );
    }
  }
}
