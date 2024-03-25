import { mock} from "node:test"
import LockFactory, {Storage} from "../lock-operations.js"
import {PostgresDb} from "../db/pg.js"
import {LockAcquireObject, ReleaseLocks} from "../db/db.js"
import { describe, it, beforeEach } from "mocha"
import { assert, expect } from "chai"

describe("Lock Operation", () => {
  // Mock the pg class
  let lockId = "lock-test-comp";
  let owner = "owner1";
  let lock: LockAcquireObject = {
    lockId,
    owner: owner,
    expiryInSec: 10,
  };
  mock.method(PostgresDb.prototype, "format_nd_execute", async () => {
    return {
      rows: [
        {
          lock_id: lockId,
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
          lock_id: lockId,
        },
      ],
    };
  });
  let storage: Storage;

  beforeEach(() => {
    storage = LockFactory.instantiate();
  });

  it("should store and result values", async () => {
    const resp = await storage.acquire(lock, new PostgresDb())
    expect(resp.lockId).eq("lock-test-comp")
    expect(resp.acquired).eq(true)
    expect(resp.lockExpiry).gt(new Date())
  });

  it("should release locks  ", async () => {
    let releaseObj: ReleaseLocks = {
        lockIds: [ "lock-test-comp2" ],
        owner: "test-app"
    }
    assert.deepStrictEqual(await storage.release(releaseObj, new PostgresDb()), [
      lockId,
    ]);
  });
  it("should keep alive the existing locks ", async () => {
    assert.deepStrictEqual(
      await storage.keepAlive({lockIds: [lockId], owner: owner}, new PostgresDb()),
      [lockId]
    );
  });
});
