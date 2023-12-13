import {expect} from "chai"
import {describe, it} from "mocha"
import {ApiRoutes} from "../api-routes/index.js"
import express from "express"
import supertest from "supertest"
import Sinon from "sinon"
import { PostgresDb } from "../db/pg.js"

describe("API routes", () => {

  // supertest request instantiate with express app
  // in a test setup, we can instantiate express app and pass it to supertest

  const app = express()
  const jsonParser = express.json()
  
  app.use(jsonParser)
  let mockdb = Sinon.createStubInstance(PostgresDb)
  let apiRoutes = new ApiRoutes(app, mockdb)

  let lockId = Math.random().toString(12)
  let owner = "owner1"
  let acquirePostPayload = JSON.stringify({
    lockId,
    owner,
    expiryInSec: 10,
  })
  let keepAlivePostPayload = {
    lockIds:[lockId],
    owner,
  }

  let releasePostPayload = {
    lockIds:[lockId],
  }


  it("should test API Routes", async () => {
    expect(apiRoutes).to.be.an("object")
  })

  //supertest request instantiate with apiRoutes.app
    const request = supertest(apiRoutes.app)
    it("should test default API Route", async () => {
      const response = await request.get("/")
      expect(response.status).to.equal(200)
      expect(response.body).to.be.an("object")
      expect(response.body.app).to.equal("lock-manager")
      expect(response.body.time).to.be.an("string")
    })

    it("should test success for acquire API Route", async () => {
     
      const response = await request.post("/locks/acquire")
      .set("Accept", "application/json")
      .set('Content-Type', 'application/json')
      .send(acquirePostPayload)
      expect(response.status).to.equal(200)
    })
    
    it("should test success keep-alive API Route", async () => {
      const response = await request.post("/locks/keep-alive").set("Accept", "application/json")
      .set('Content-Type', 'application/json')
      .send(keepAlivePostPayload)
      expect(response.status).to.equal(200)
    })
    
    it("should test success release API Route", async () => {
      const response = await request.post("/locks/release")
      .set("Accept", "application/json")
      .set('Content-Type', 'application/json')
      .send(releasePostPayload.lockIds)
      expect(response.status).to.equal(200)
    })

    // The failure scenarios can be tested by removing stub and using actual DB connection
    // it("should test failure for acquire API Route", async () => {
    //   await request.post("/locks/acquire")
    //   .set("Accept", "application/json")
    //   .set('Content-Type', 'application/json')
    //   .send(acquirePostPayload)

    //   const response = await request.post("/locks/acquire")
    //   .set("Accept", "application/json")
    //   .set('Content-Type', 'application/json')
    //   .send(acquirePostPayload)
    //   .expect(409)

    //   expect(response.status).to.equal(409)
    //   expect(response.body).to.be.empty
    // })
    
    // it("should test failure keep-alive API Route", async () => {
    //   keepAlivePostPayload.lockIds = []
    //   const response = await request.post("/locks/keep-alive").set("Accept", "application/json")
    //   .set('Content-Type', 'application/json')
    //   .send(keepAlivePostPayload)
    //   .expect(400)
    //   expect(response.status).to.equal(400)
    //   expect(response.body).to.be.empty
    // })
    
    // it("should test failure release API Route", async () => {
    //   const response = await request.post("/locks/release")
    //   .set("Accept", "application/json")
    //   .set('Content-Type', 'application/json')
    //   .send([])
    //   .expect(400)
    //   expect(response.status).to.equal(400)
    //   expect(response.body).to.be.empty
    // })


})

