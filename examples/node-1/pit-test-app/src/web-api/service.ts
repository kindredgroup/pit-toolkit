import {Express, Request, Response, response} from "express";
// import fetch from "node-fetch"

import {logger} from "../logger.js";
import * as webapi from "./schema-v1.js";
import * as report from "../report/schema-v1.js";
import ScyllaManager, {
  AddTaskModel,
  DbConfig,
  GetTaskModel,
  Task,
  TaskStatus,
} from "scylla_pg_client";
import {v4 as uuid} from "uuid";
import * as hdr from "hdr-histogram-js";

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
        // iterations: 1000,
        name: 'Complete Task Flow',
        requirements: [new report.ScalarMetric("p95", 300)],
      }
    ]

    const scenarios = new Array<webapi.ExecutedTestScenario>()

    for (let spec of specs) {
      const startedAt = new Date()
      const stats = await this.runTestScenario(testSuiteId, iterationsCount,spec.name)
      const finishedAt = new Date()

      const elapsedMs = finishedAt.getTime() - startedAt.getTime()
      const objectToMap = obj => new Map(Object.entries(obj));
      const summaryMap = objectToMap(stats.summary)

      const rate = summaryMap["p90"]
      const outcome =
        rate >= spec.requirements[0].value
          ? report.TestOutcomeType.PASS
          : report.TestOutcomeType.FAIL;
      const throughput = new report.ScalarMetric("throughput", 1000)
      console.log("stats: ", stats.summary, typeof stats.summary)
      const distribution =  new report.DistributionMetric("stats", summaryMap)
      const stream = new report.TestStream(
        "default",
        spec.requirements,
        [distribution],
        report.TestOutcomeType.PASS
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
    // const endpoint = `${ this.targetServiceUrl }/addTask`
    // console.log("start API test scenario:",endpoint)
    const dbConfig: DbConfig = {
      pgHost: "localhost",
      pgPort: 5432,
      pgUser: "postgres",
      pgPassword: "postgres",
      pgDatabase: "scylla",
      pgPoolSize: 10,
    };
    const scyllaManager = await ScyllaManager.initiate(dbConfig)

    const stats = {min: -1, max: -1, avg: -1, duration: 0, requests: 0};
    const errors = {system: 0, api: 0};

    let promises = []

    const sleep = (ms: number) => {
      return new Promise(resolve => setTimeout(resolve, ms))
    };
    const addTask = async () => {
      const task: AddTaskModel = {
        rn: uuid(),
        queue: "test",
        spec: {},
        priority: 1,
      };
      return await scyllaManager.addTask(task)
      // await fetch(endpoint,{
      //   method: 'GET',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     "Accept": "application/json"
      //   },
      // })
    };

    const start = new Date()
  

    const h = hdr.build()
    try {
      //Listener
      // for (let i = 0; i < iterationsCount; i++) {
      //   promises.push(
      //     startTimes[i] = new Date().getTime(),
      //     new Promise(async resolved => {
      //       let outcome = await addTask()
      //       console.log("outcome: ", outcome)
      //       sleep(10)
      //       endTimes[i] = new Date().getTime()
      //       return resolved(outcome)
      //     })
      //   )

      // }

      // await Promise.all(promises)

      //worker

    const workerFlow = async () => {
      const startTime = new Date().getTime()
      let timeElapsed = 0;
      const task: Task = await addTask()
      let leasedTask;
      let completedTask;
      // Right now No retries
      if(!!task?.rn) {
        leasedTask = await scyllaManager.leaseTask(task?.rn,'scylla-test-app')
      }
      if(!!leasedTask?.rn) {
        completedTask = await scyllaManager.completeTask(leasedTask?.rn)
      }
      if(!!completedTask?.rn) {
        const endTimes = new Date().getTime()
        timeElapsed = endTimes - startTime
        // h.recordValue(timeElapsed[index])
      }
      
      return timeElapsed
    }
      //break iterationsCount into chunks of 100
      const chunkSize = 100
      let chunks = iterationsCount
      let counter = 0
      while (chunks > 0) {

        promises = []
        for (let j = 0; j < chunkSize; j++) {
          promises.push(
            new Promise(async resolved => {
              let outcome = await workerFlow()
              h.recordValue(outcome)
              return resolved(outcome)
            })
            )
            counter++
            sleep(10)
          }
          await Promise.all(promises)
          chunks = chunks - chunkSize
        }
     
     
      stats.requests = iterationsCount
      
      // console.log(`Statistics for worker flow ${h}`)

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
