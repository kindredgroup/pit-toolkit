import assert from "node:assert";
import {beforeEach, describe, it, mock} from "node:test";
import LockFactory from "./lock_operations.js";
import type {Storage} from "./lock_operations.js";
import {PostgresDb} from "./db/pg.js";
import {LockAcquireObject} from "./db/db.js";

// Mock the pg class
let key = "key1";
let owner = "owner1";
let lock: LockAcquireObject = {
    lockId: key,
    owner: owner,
    expiryInSec: 10,
  };
mock.method(PostgresDb.prototype, "format_nd_execute", async () => {
  return {
    rows: [
      {
        lock_id: key,
        owner: owner,
        expiration: new Date(),
      },
    ],
  };
});
mock.method(PostgresDb.prototype, "execute", async () => {
  return {
    rows: [
      {
        lock_id: key,
       
      },
    ],
  };
});


describe("DatabaseStorage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = LockFactory.instantiate();
  });

  it("should store and result values", async () => {
    
    assert.deepStrictEqual(await storage.acquire(lock, new PostgresDb()), 
      {lockId: "key1", acquired: true},
    );
  });

  it("should release lease ofr requested keys ", async () => {
     key = "key2";
    assert.deepStrictEqual(await storage.release([key],new PostgresDb()), [key]);
  });
  it("should renew lease for requested keys ", async () => {
    assert.deepStrictEqual(await storage.keepAlive({lockIds:[key],owner:owner},new PostgresDb()), [key]);
  });
});
