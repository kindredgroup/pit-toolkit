import esmock from "esmock"
import * as sinon from "sinon"
import * as chai from "chai"
import { SpawnOptions } from "child_process"
import { RequestInit } from "node-fetch"

import { logger } from "../src/logger.js"

import * as webapi from "../src/test-app-client/web-api/schema-v1.js"
import { ShellOptions } from "../src/shell-facade.js"
import { LocationType } from "../src/pitfile/schema-v1.js"
import { SchemaVersion } from "../src/pitfile/version.js"
import { Config, DEFAULT_SUB_NAMESPACE_PREFIX, SUB_NAMESPACE_GENERATOR_TYPE_DATE } from "../src/config.js"
import { ScalarMetric, TestOutcomeType, TestStream } from "../src/test-app-client/report/schema-v1.js"
import { generatePrefixByDate } from "../src/test-suite-handler.js"

describe("Helper functions", () => {
  it ("should generate readable date prefix", () => {
    const date = new Date('March 1, 2024 00:00:00.123 UTC')
    const prefix = generatePrefixByDate(date, "desktop")

    chai.expect(prefix).eq("pit2024-03-01_000000123_desktop")
  })
})

describe("Deployment happy path", async () => {
  const prefix = "12345"
  const testSuiteId = "t1"
  const namespace = "nsChild"
  const workspace = `${ prefix }_${ testSuiteId }`
  const k8DeployerConfig: Config = {
    commitSha: "sha4567",
    workspace: "/tmp/some/dir",
    clusterUrl: "http://localhost:333",
    parentNamespace: "nsParent",
    subNamespacePrefix: DEFAULT_SUB_NAMESPACE_PREFIX,
    subNamespaceGeneratorType: SUB_NAMESPACE_GENERATOR_TYPE_DATE,
    pitfile: "not-used",
    namespaceTimeoutSeconds: 2,
    report: {},
    targetEnv: "desktop",
    testStatusPollFrequencyMs: 500,
    testTimeoutMs: 2_000,
    deployCheckFrequencyMs: 500,
    params: new Map(),
    useMockLockManager: false,
    servicesAreExposedViaProxy: false,
    lockManagerApiRetries: 3,
    enableCleanups: true,
  }

  const testSuiteNumber = "1"
  const testSuite = {
    id: "t1",
    name: "t1-name",
    location: { type: LocationType.Local },
    deployment: {
      graph: {
        testApp: {
          name: "comp-1-test-app-name",
          id: "comp-1-test-app",
          location: { type: LocationType.Local },
          deploy: {
            command: "deployment/pit/deploy.sh",
            statusCheck: { timeoutSeconds: 1, command: "deployment/pit/is-deployment-ready.sh" }
          },
          logTailing: {
            enabled: true
          }
        },
        components: [
          {
            name: "comp-1-name",
            id: "comp-1",
            location: { type: LocationType.Local },
            deploy: { command: "deployment/pit/deploy.sh", statusCheck: { timeoutSeconds: 1, command: "deployment/pit/is-deployment-ready.sh" }}
          }
        ]
      }
    }
  }

  it ("processTestSuite", async () => {

    const report = {
      executedScenarios: [
        new webapi.ExecutedTestScenario(
          "t1-sc1",
          new Date(),
          new Date(new Date().getTime() + 20_000),
          [ new TestStream("t1-sc1-stream1", [ new ScalarMetric("tps", 100) ], [ new ScalarMetric("tps", 101) ], TestOutcomeType.PASS) ],
          ["comp-1"]
        )
      ]
    }

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Mock the environment
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    const execStub = sinon.stub()
    const shellImportMock = {
      exec: async (command: string, options?: ShellOptions) => {
        if (options) {
          logger.info("mock::shell-exec('%s', %s)", command, options)
        } else {
          logger.info("mock::shell-exec('%s')", command)
        }
        execStub(command, options)
      }
    }

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    const fsAccessStubs = sinon.stub()
    // checking the presense of workspace
    fsAccessStubs.withArgs(workspace).throws(new Error("path is not writable"))
    // all other access checks
    fsAccessStubs.returns(true)

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    const httpClientStub = sinon.stub()
    httpClientStub.withArgs(sinon.match(`\/${ namespace }\.${ testSuiteId }\/start`), sinon.match.any).returns({
      ok: true,
      json: async () => new webapi.StartResponse("session-1", testSuiteId)
    })
    const respStatusRunning = {
      ok: true,
      json: async () => new webapi.StatusResponse("session-1", testSuiteId, webapi.TestStatus.RUNNING)
    }
    const respStatusCompleted = { ok: true, json: async () => new webapi.StatusResponse("session-1", testSuiteId, webapi.TestStatus.COMPLETED)}
    httpClientStub.withArgs(sinon.match(`\/${ namespace }\.${ testSuiteId }\/status\?sessionId=session-1`), sinon.match.any)
      .onFirstCall().returns(respStatusRunning)
      .onSecondCall().returns(respStatusRunning)
      .onThirdCall().returns(respStatusCompleted)

    httpClientStub.withArgs(sinon.match(`\/${ namespace }\.${ testSuiteId }\/reports\?sessionId=session-1`), sinon.match.any)
      .returns(
        {
          ok: true,
          json: async () => { return new webapi.ReportResponse("session-1", testSuiteId, webapi.TestStatus.COMPLETED, report) }
        }
      )

    const httpImportMock = async (url: string, options: RequestInit) => {
      let debugOpts = options
      if (debugOpts.body) debugOpts = { ...options, body: JSON.parse(options.body as string) }
      logger.info("mock::fetch(%s, %s)", url, JSON.stringify(debugOpts))
      return await httpClientStub(url, options)
    }

    const K8s = await esmock("../src/k8s.js", { "../src/shell-facade.js": shellImportMock })

    // mock log tailing logic

    const killChilldStub = sinon.stub()
    killChilldStub.returns(true)

    const tailerInstanceStub = {
      pid: 1111,
      kill: (signal: string) => killChilldStub(signal)
    }

    const nodeShellSpawnStub = sinon.stub()
    nodeShellSpawnStub.returns(tailerInstanceStub)

    const PodLogTail = await esmock(
      "../src/pod-log-tail.js",
      {
        "fs": { openSync: (a: string, b: string): number => { return 0 } },
        "child_process": {
          spawn: (script: string, args: string[], opts: SpawnOptions[]) => {
            // delegate spawining calls to stub and record them for later assertion
            return nodeShellSpawnStub(script, args, opts) }
        }
      }
    )

    const SuiteHandler = await esmock(
      "../src/test-suite-handler.js",
      {
        "../src/k8s.js": { ...K8s, generateNamespaceName:() => namespace  } ,
        "../src/pod-log-tail.js": { ...PodLogTail  }
      },
      {
        "../src/logger.js": { logger: { debug: () => {}, info: () => {}, warn: (s: string, a: any) => { logger.warn(s, a) }, error: (s: string, a: any) => { logger.error(s, a) } } },
        "node-fetch": httpImportMock,
        "../src/shell-facade.js": shellImportMock,
        "fs": { promises: { access: async (path: string, mode: number) => await fsAccessStubs(path, mode) }}
      },
    )

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // End of mocking
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    const pitfile = {
      projectName: "TestPitFile",
      version: SchemaVersion.VERSION_1_0,
      lockManager: { enabled: true },
      testSuites: [ testSuite ]
    }

    await SuiteHandler.processTestSuite(prefix, k8DeployerConfig, pitfile, testSuiteNumber, testSuite)
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Assert interactions with external services
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    // check verification for expected directories and shell executables

    chai.expect(fsAccessStubs.callCount).eq(7)

    // check for presense of workspace direectory on the disk
    chai.expect(fsAccessStubs.getCall(0).calledWith(workspace)).be.true
    chai.expect(fsAccessStubs.getCall(1).calledWith("lock-manager/deployment/pit/deploy.sh")).be.true
    chai.expect(fsAccessStubs.getCall(2).calledWith("lock-manager/deployment/pit/is-deployment-ready.sh")).be.true
    chai.expect(fsAccessStubs.getCall(3).calledWith("comp-1/deployment/pit/deploy.sh")).be.true
    chai.expect(fsAccessStubs.getCall(4).calledWith("comp-1/deployment/pit/is-deployment-ready.sh")).be.true
    chai.expect(fsAccessStubs.getCall(5).calledWith("comp-1-test-app/deployment/pit/deploy.sh")).be.true
    chai.expect(fsAccessStubs.getCall(6).calledWith("comp-1-test-app/deployment/pit/is-deployment-ready.sh")).be.true

    // check shell calls

    // debugging tools
    // for (let i = 8; i < execStub.callCount; i++) {
    //   logger.info("%s) %s", i, execStub.getCall(i).args)
    // }
    //
    // chai.expect(execStub.getCall(9).args[0]).eq(`deployment/pit/deploy.sh nsChild t1`)
    // chai.expect(execStub.getCall(9).args[1]).eq(param2)

    chai.expect(execStub.callCount).eq(11)
    chai.expect(execStub.getCall(0).calledWith(`mkdir -p 12345_t1/logs`)).be.true
    chai.expect(execStub.getCall(1).calledWith(`mkdir -p 12345_t1/reports`)).be.true

    chai.expect(execStub.getCall(2).calledWith(
      `k8s-deployer/scripts/k8s-manage-namespace.sh nsParent create "nsChild" 2`,
      { logFileName: `12345_t1/logs/create-ns-nsChild.log`, timeoutMs: 2000, tailTarget: sinon.match.any }
    )).be.true

    chai.expect(execStub.getCall(3).calledWith(
      `deployment/pit/deploy.sh nsChild lock-manager`,
      { homeDir: "lock-manager", logFileName: `12345_t1/logs/deploy-nsChild-lock-manager.log`, tailTarget: sinon.match.any })
    ).be.true

    chai.expect(execStub.getCall(4).calledWith(
      `deployment/pit/is-deployment-ready.sh nsChild`,
      { homeDir: "lock-manager" })
    ).be.true

    chai.expect(execStub.getCall(5).calledWith(`cd comp-1 && git log --pretty=format:"%h" -1`)).be.true

    chai.expect(execStub.getCall(6).calledWith(
      `deployment/pit/deploy.sh nsChild`,
      { homeDir: "comp-1", logFileName: `12345_t1/logs/deploy-nsChild-comp-1.log`, tailTarget: sinon.match.any })
    ).be.true

    chai.expect(execStub.getCall(7).calledWith(
      `deployment/pit/is-deployment-ready.sh nsChild`,
      { homeDir: "comp-1" }
    )).be.true

    chai.expect(execStub.getCall(8).calledWith(`cd comp-1-test-app && git log --pretty=format:"%h" -1`)).be.true
    chai.expect(execStub.getCall(9).calledWith(
      `deployment/pit/deploy.sh nsChild t1`,
      { homeDir: "comp-1-test-app", logFileName: `12345_t1/logs/deploy-nsChild-comp-1-test-app.log`, tailTarget: sinon.match.any })
    ).be.true

    chai.expect(execStub.getCall(10).calledWith(
      `deployment/pit/is-deployment-ready.sh nsChild`,
      { homeDir: "comp-1-test-app" })
    ).be.true

    // assert that log tailing was invoked
    chai.expect(nodeShellSpawnStub.callCount).eq(1)
    chai.expect(nodeShellSpawnStub.getCall(0).calledWith(
      "k8s-deployer/scripts/tail-container-log.sh",
      [ namespace, "comp-1-test-app" ]
    )).be.true
  })
})