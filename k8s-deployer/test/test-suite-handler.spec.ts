import esmock from "esmock"
import * as sinon from "sinon"
import * as chai from "chai"

import * as webapi from "../src/test-app-client/web-api/schema-v1.js"
import { ShellOptions } from "../src/shell-facade.js"
import { logger } from "../src/logger.js"
import { LocationType } from "../src/pitfile/schema-v1.js"
import { SchemaVersion } from "../src/pitfile/version.js"
import { RequestInit } from "node-fetch"
import { Config, DEFAULT_SUB_NAMESPACE_PREFIX, SUB_NAMESPACE_GENERATOR_TYPE_DATE } from "../src/config.js"
import { ScalarMetric, TestOutcomeType, TestStream } from "../src/test-app-client/report/schema-v1.js"

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
    testStatusPollFrequencyMs: 500,
    testTimeoutMs: 2_000,
    deployCheckFrequencyMs: 500,
    params: new Map(),
    useMockLockManager: true,
    servicesAreExposedViaProxy: false,
    lockManagerApiRetries: 3
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
    const SuiteHandler = await esmock(
      "../src/test-suite-handler.js",
      { "../src/k8s.js": { ...K8s, generateNamespaceName:() => namespace  } },
      {
        "../src/logger.js": { logger: { debug: () => {}, info: () => {}, warn: (s: string, a: any) => { logger.warn(s, a) }, error: (s: string, a: any) => { logger.error(s, a) } } },
        "node-fetch": httpImportMock,
        "../src/shell-facade.js": shellImportMock,
        "fs": { promises: { access: async (path: string, mode: number) => await fsAccessStubs(path, mode) }}
      }
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

    chai.expect(fsAccessStubs.callCount).eq(5)

    // restore line below once lock manager is stable
    //chai.expect(fsAccessStubs.callCount).eq(7)

    // check for presense of workspace direectory on the disk
    chai.expect(fsAccessStubs.getCall(0).calledWith(workspace)).be.true
    chai.expect(fsAccessStubs.getCall(1).calledWith("lock-manager/deployment/pit/deploy.sh")).be.false
    chai.expect(fsAccessStubs.getCall(2).calledWith("lock-manager/deployment/pit/is-deployment-ready.sh")).be.false
    chai.expect(fsAccessStubs.getCall(1).calledWith("comp-1/deployment/pit/deploy.sh")).be.true
    chai.expect(fsAccessStubs.getCall(2).calledWith("comp-1/deployment/pit/is-deployment-ready.sh")).be.true
    chai.expect(fsAccessStubs.getCall(3).calledWith("comp-1-test-app/deployment/pit/deploy.sh")).be.true
    chai.expect(fsAccessStubs.getCall(4).calledWith("comp-1-test-app/deployment/pit/is-deployment-ready.sh")).be.true

    // check shell calls

    // debugging tools
    // for (let i = 8; i < execStub.callCount; i++) {
    //   logger.info("%s) %s", i, execStub.getCall(i).args)
    // }
    //
    // chai.expect(execStub.getCall(9).args[0]).eq(`deployment/pit/deploy.sh nsChild t1`)
    // chai.expect(execStub.getCall(9).args[1]).eq(param2)

    // restore line below once lock manager is stable
    //chai.expect(execStub.callCount).eq(11)
    chai.expect(execStub.callCount).eq(9)
    chai.expect(execStub.getCall(0).calledWith(`mkdir -p 12345_t1/logs`)).be.true
    chai.expect(execStub.getCall(1).calledWith(`mkdir -p 12345_t1/reports`)).be.true

    chai.expect(execStub.getCall(2).calledWith(
      `k8s-deployer/scripts/k8s-manage-namespace.sh nsParent create "nsChild" 2`,
      { logFileName: `12345_t1/logs/create-ns-nsChild.log`, timeoutMs: 2000, tailTarget: sinon.match.any }
    )).be.true

    chai.expect(execStub.getCall(3).calledWith(
      `deployment/pit/deploy.sh nsChild lock-manager`,
      { homeDir: "lock-manager", logFileName: `12345_t1/logs/deploy-nsChild-lock-manager.log`, tailTarget: sinon.match.any })
    ).be.false

    chai.expect(execStub.getCall(4).calledWith(
      `deployment/pit/is-deployment-ready.sh nsChild`,
      { homeDir: "lock-manager" })
    ).be.false

    chai.expect(execStub.getCall(3).calledWith(`cd comp-1 && git log --pretty=format:"%h" -1`)).be.true

    chai.expect(execStub.getCall(4).calledWith(
      `deployment/pit/deploy.sh nsChild`,
      { homeDir: "comp-1", logFileName: `12345_t1/logs/deploy-nsChild-comp-1.log`, tailTarget: sinon.match.any })
    ).be.true

    chai.expect(execStub.getCall(5).calledWith(
      `deployment/pit/is-deployment-ready.sh nsChild`,
      { homeDir: "comp-1" }
    )).be.true

    chai.expect(execStub.getCall(6).calledWith(`cd comp-1-test-app && git log --pretty=format:"%h" -1`)).be.true
    chai.expect(execStub.getCall(7).calledWith(
      `deployment/pit/deploy.sh nsChild t1`,
      { homeDir: "comp-1-test-app", logFileName: `12345_t1/logs/deploy-nsChild-comp-1-test-app.log`, tailTarget: sinon.match.any })
    ).be.true

    chai.expect(execStub.getCall(8).calledWith(
      `deployment/pit/is-deployment-ready.sh nsChild`,
      { homeDir: "comp-1-test-app" })
    ).be.true
  })
})