import assert from "node:assert";
import {beforeEach, describe, it, mock} from "node:test";
import LockFactory from "./acquireLock.js";
import type {Storage} from "./acquireLock.js";
import {PostgresDb} from "./db/pg.js";
import {LockManagerDTO} from "./db/db.js";

// Mock the pg class
let key = "key1";
let owner = "owner1";
let lock: LockManagerDTO = {
    lockKey: key,
    owner: owner,
    expiryInSec: 10,
  };
mock.method(PostgresDb.prototype, "format_nd_execute", async () => {
  return {
    rows: [
      {
        key: key,
        owner: owner,
        expiration: new Date(),
      },
    ],
  };
});

describe("ArrayStorage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = LockFactory.instantiate("array");
  });
  let lock: LockManagerDTO = {
    lockKey: "key1",
    owner: "owner1",
    expiryInSec: 10,
  };

  it("should store and retrieve values", async () => {
    assert.deepStrictEqual(await storage.acquire([lock], undefined), [
      {
        acquired: true,
        lockKey: "key1",
      },
    ]);
  });
  it("should not store duplicate keys", async () => {
    assert.deepStrictEqual(await storage.release(["key1"], undefined), [
      "key1",
    ]);
  });
});

describe("DatabaseStorage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = LockFactory.instantiate("db");
  });

  it("should store and result values", async () => {
    
    assert.deepStrictEqual(await storage.acquire([lock], new PostgresDb()), [
      {lockKey: "key1", acquired: true},
    ]);
  });

  it("should release requested keys ", async () => {
     key = "key2";
    assert.deepStrictEqual(await storage.release([key],new PostgresDb()), [key]);
  });
});
