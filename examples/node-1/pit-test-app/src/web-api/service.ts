import {Express, Request, Response, response} from "express";
// import fetch from "node-fetch"

import {logger} from "../logger.js";
import * as webapi from "./schema-v1.js";
import * as report from "../report/schema-v1.js";

import * as hdr from "hdr-histogram-js";
import { ScyllaTests } from "./ScyllaLib.js";


enum TESTFLOW {
  WORKER = 'WORKER',
  LISTENER = 'LISTENER',
  COMPLETE = 'COMPLETE',
}
export class WebService {
  private globalSessionId: number = 0;
  private sessions: Map<number, any> = new Map()

  constructor(readonly app: Express, readonly targetServiceUrl: string) {
    app.post("/start", async (req: Request, res: Response) =>
      this.postStart(req, res)
    )
    app.get("/status", async (req: Request, res: Response) =>
      this.getStatus(req, res)
    )
    app.get("/reports", async (req: Request, res: Response) =>
      this.getReports(req, res)
    )
  }

  private async postStart(req: Request, res: Response) {
    const sessionId = ++this.globalSessionId;
    // const startRequest = req.body as webapi.StartRequest;
    const startRequest = req.body ;

    const sessionMeta = {sessionId, testSuiteId: startRequest.testSuiteId};
    this.sessions.set(sessionId, {
      status: webapi.TestStatus.PENDING,
      ...sessionMeta,
    })

    try {
      logger.info("Running test: '%s'", startRequest.testSuiteId)
      setTimeout(async () => {
        try {
          const scenarios = await this.runTests(
            startRequest.testSuiteId,
            sessionId,
            startRequest.iterationsCount // temp for ease of execution
          )
          const reportEnvelope = new webapi.ReportEnvelope(scenarios)
          this.sessions.set(sessionId, {
            status: webapi.TestStatus.COMPLETED,
            reportEnvelope,
            ...sessionMeta,
          })
        } catch (e) {
          this.sessions.set(sessionId, {
            status: webapi.TestStatus.ERROR,
            error: e.message,
            ...sessionMeta,
          })
          logger.error("Message: %s", e.message)
          if (e.cause) logger.error(e.cause)
          if (e.stack) logger.error("Stack:\n%s", e.stack)
        }
      }, 0)

      res.json(
        new webapi.StartResponse(sessionId.toString(), startRequest.testSuiteId)
      )
    } catch (e) {
      logger.error("Message: %s", e.message)
      if (e.cause) logger.error(e.cause)
      if (e.stack) logger.error("Stack:\n%s", e.stack)
      res.sendStatus(500)
    }
  }

  private async getStatus(req: Request, res: Response) {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(422).send('Invalid parameter "sessionId"')
      return;
    }

    sessionId = parseInt(sessionId + "")
    if (!this.sessions.has(sessionId)) {
      res.status(422).send("No such session")
      return;
    }

    const {testSuiteId, status} = this.sessions.get(sessionId)
    res.json(new webapi.StatusResponse(sessionId, testSuiteId, status))
  }

  private async getReports(req: Request, res: Response) {
    let sessionId: any = req.query["sessionId"]
    if (!sessionId) {
      res.status(422).send('Invalid parameter "sessionId"')
      return;
    }

    sessionId = parseInt(sessionId + "")
    if (!this.sessions.has(sessionId)) {
      res.status(422).send("No such session")
      return;
    }

    const {status, testSuiteId, reportEnvelope, error} =
      this.sessions.get(sessionId)
    if (status !== webapi.TestStatus.COMPLETED) {
      res.json(
        new webapi.ReportResponse(sessionId, testSuiteId, status, null, error)
      )
      return;
    }

    res.json(
      new webapi.ReportResponse(sessionId, testSuiteId, status, reportEnvelope)
    )
  }

  private async runTests(
    testSuiteId: string,
    sessionId: number,
    iterationsCount: number
  ): Promise<Array<webapi.ExecutedTestScenario>> {
    this.sessions.get(sessionId).status = webapi.TestStatus.RUNNING;

    const specs = [
     
      {
        iterations: 1000,
        name: TESTFLOW.COMPLETE,
        requirements: [new report.ScalarMetric("p90", 2)],
      },
      {
        iterations: 1000,
        name: TESTFLOW.LISTENER,
        requirements: [new report.ScalarMetric("p90", 2)],
      },
      // Not implemented yet
      // {
      //   iterations: 1000,
      //   name: TESTFLOW.WORKER,
      //   requirements: [new report.ScalarMetric("p90", 2)],
      // }
    ]

    const scenarios = new Array<webapi.ExecutedTestScenario>()

    for (let spec of specs) {
      const startedAt = new Date()
      const stats = await this.runTestScenario(testSuiteId, spec.iterations, spec.name)
      const finishedAt = new Date()

      const elapsedMs = finishedAt.getTime() - startedAt.getTime()
      const objectToMap = obj => new Map(Object.entries(obj));
      const summaryMap = objectToMap(stats.summary)

      let bucket = spec.requirements[0].value
      const rate = summaryMap[bucket]
      const outcome =
        rate >= spec.requirements[0].value
          ? report.TestOutcomeType.PASS
          : report.TestOutcomeType.FAIL;
      console.log("stats: ", stats.summary, typeof stats.summary)
      const distribution =  new report.DistributionMetric("stats", summaryMap)
      const stream = new report.TestStream(
        "default",
        spec.requirements,
        [distribution],
        outcome
      )
      const scenario = new webapi.ExecutedTestScenario(
        spec.name,
        startedAt,
        finishedAt,
        [stream],
        ["node-1"]
      )
      scenarios.push(scenario)
    }

    return scenarios;
  }

  private async runTestScenario(
    _testSuiteId: string,
    iterationsCount: number,
    flowName: string
  ): Promise<any> {
    const sleep = (ms: number) => {
      return new Promise(resolve => setTimeout(resolve, ms))
    };
    
    const start = new Date()

    const h = hdr.build()
    
    try {
     
      let scyllaTestFlow = new ScyllaTests()
      await scyllaTestFlow.instantiateScyllaManager()

      let startTime = new Date().getTime()
      let requiredRate = 1000
      for (let i = 0; i <= iterationsCount; i++) {
        
        if (TESTFLOW.COMPLETE === flowName) {
          const outcome = await scyllaTestFlow.completeFlow();
          h.recordValue(outcome)
        }
        if (TESTFLOW.LISTENER === flowName) {
          const outcome = await scyllaTestFlow.listenerFlow();
          h.recordValue(outcome)
        }

        const now = new Date().getTime()
        const elapsedSec = (now - startTime) / 1000
        const currentRate = i / elapsedSec
        if(currentRate > requiredRate){
          // console.log(`Current rate: ${currentRate} calls/s`)
          const timeToFinCurrent = i/requiredRate
          const requiredSleep = (timeToFinCurrent - elapsedSec) * 1000
          await sleep(requiredSleep)
        }
      }
    } catch (err) {
      // no retries
      console.log("Error: ", err)
    } finally {
      console.log("Finally")
      const timeElapsed =  (new Date().getTime() - start.getTime())/1000;
      console.log(`Time elapsed: ${timeElapsed} s`)
      const rate = iterationsCount / timeElapsed;
      console.log(`Rate: ${rate} calls/s`)

    }

    return h;
  }
  

}
