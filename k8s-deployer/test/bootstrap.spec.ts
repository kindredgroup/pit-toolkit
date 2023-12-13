
import * as sinon from "sinon"
import * as chai from "chai"

import { 
  PARAM_CLUSTER_URL, 
  PARAM_COMMIT_SHA, 
  PARAM_LOCK_MANAGER_MOCK, 
  PARAM_NAMESPACE_TIMEOUT, 
  PARAM_PARENT_NS, 
  PARAM_SUBNS_PREFIX, 
  PARAM_SUBNS_NAME_GENERATOR_TYPE, 
  PARAM_PITFILE, 
  PARAM_WORKSPACE, 
  readParams,
  PARAM_LOCK_MANAGER_API_RETRIES
} from "../src/bootstrap.js"
import { 
  DEFAULT_CLUSTER_URL, 
  DEFAULT_NAMESPACE_TIMEOUT, 
  DEFAULT_SUB_NAMESPACE_PREFIX, 
  DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE
} from "../src/config.js"

describe("bootstrap with correct configs", () => {
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    sandbox.stub(process, 'argv').value([
      "skip-first", "",
      PARAM_COMMIT_SHA, "abcdef1",
      PARAM_WORKSPACE, "/my-test-workspace",
      PARAM_PITFILE, "/some-pitfile.yml",
      PARAM_NAMESPACE_TIMEOUT, "100",
      PARAM_CLUSTER_URL, "http://some-host.name",
      PARAM_PARENT_NS, "dev",
      PARAM_SUBNS_PREFIX, DEFAULT_SUB_NAMESPACE_PREFIX,
      PARAM_LOCK_MANAGER_MOCK, "false",
      PARAM_LOCK_MANAGER_API_RETRIES, 3
     ])
  })

  it("readParams() should return populated config", () => {
    const config = readParams()
    chai.expect(config.workspace).eq("/my-test-workspace")
    chai.expect(config.pitfile).eq("/some-pitfile.yml")
    chai.expect(config.namespaceTimeoutSeconds).eq(100)
    chai.expect(config.clusterUrl).eq("http://some-host.name")
    chai.expect(config.subNamespacePrefix).eq(DEFAULT_SUB_NAMESPACE_PREFIX)
    chai.expect(config.subNamespaceGeneratorType).eq(DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE)
    chai.expect(config.useMockLockManager).be.false
    chai.expect(config.lockManagerApiRetries).be.eq(3)
  })

  afterEach(() => {
    sandbox.restore()
  })

})

describe("bootstrap with invalid configs", () => {
  const sandbox = sinon.createSandbox()

  it("readParams() should complain about params without values", () => {
    sandbox.stub(process, 'argv').value([ "skip-first", "", PARAM_WORKSPACE ])
    chai.expect(readParams).to.throw("Invalid parameters format. Expected format is")
    sandbox.restore()
  })

  it(`readParams() should expect param ${ PARAM_WORKSPACE }`, () => {
    sandbox.stub(process, 'argv').value([ "skip-first", "", PARAM_COMMIT_SHA, "abcdef1", PARAM_PARENT_NS, "dev" ])
    chai.expect(readParams).to.throw(`Missing required parameter: "${ PARAM_WORKSPACE }"`)
    sandbox.restore()
  })

  it(`readParams() should expect param ${ PARAM_PARENT_NS }`, () => {
    sandbox.stub(process, 'argv').value([ "skip-first", "", PARAM_COMMIT_SHA, "abcdef1", PARAM_WORKSPACE, "./some-dir" ])
    chai.expect(readParams).to.throw(`Missing required parameter: "${ PARAM_PARENT_NS }"`)
    sandbox.restore()
  })

  it(`readParams() should expect param ${ PARAM_COMMIT_SHA }`, () => {
    sandbox.stub(process, 'argv').value([ "skip-first", "", PARAM_WORKSPACE, "./some-dir", PARAM_PARENT_NS, "dev", ])
    chai.expect(readParams).to.throw(`Missing required parameter: "${ PARAM_COMMIT_SHA }"`)
    sandbox.restore()
  })

  it("readParams() should expect predefined namespace name generators", () => {
    sandbox.stub(process, 'argv').value([ "skip-first", "", 
      PARAM_WORKSPACE, "./some-dir", 
      PARAM_PARENT_NS, "dev", 
      PARAM_COMMIT_SHA, "abcdef1",
      PARAM_SUBNS_NAME_GENERATOR_TYPE, "unknown",
    ])
    chai.expect(readParams).to.throw(`${PARAM_SUBNS_NAME_GENERATOR_TYPE} can be "DATE" or "COMMITSHA"`)
    sandbox.restore()
  })

  it("readParams() should use default values", () => {
    sandbox.stub(process, 'argv').value([ "skip-first", "", 
      PARAM_COMMIT_SHA, "abcdef1", 
      PARAM_WORKSPACE, "/dir", 
      PARAM_PARENT_NS, "dev"
    ])
    const config = readParams()
    chai.expect(config.namespaceTimeoutSeconds).eq(DEFAULT_NAMESPACE_TIMEOUT)
    chai.expect(config.clusterUrl).eq(DEFAULT_CLUSTER_URL)
    chai.expect(config.useMockLockManager).be.false
    chai.expect(config.subNamespacePrefix).eq(DEFAULT_SUB_NAMESPACE_PREFIX)
    chai.expect(config.subNamespaceGeneratorType).eq(DEFAULT_SUB_NAMESPACE_GENERATOR_TYPE)
    chai.expect(config.useMockLockManager).be.false
    chai.expect(config.lockManagerApiRetries).be.eq(3)
    sandbox.restore()
  })

  it(`readParams() should complain about non-numeric value of ${ PARAM_NAMESPACE_TIMEOUT }`, () => {
    sandbox.stub(process, 'argv').value([
      "skip-first", "",
      PARAM_COMMIT_SHA, "abcdef1",
      PARAM_WORKSPACE, "/dir",
      PARAM_PARENT_NS, "dev",
      PARAM_NAMESPACE_TIMEOUT, "not-number"
    ])
    chai.expect(readParams).to.throw(`Invalid value "not-number" for parameter "${ PARAM_NAMESPACE_TIMEOUT }"`)
    sandbox.restore()
  })

  after(() => {
    sandbox.restore()
  })

})