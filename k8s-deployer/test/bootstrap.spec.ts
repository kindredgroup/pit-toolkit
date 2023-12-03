
import * as sinon from "sinon"
import * as chai from "chai"

import { PARAM_CLUSTER_URL, PARAM_COMMIT_SHA, PARAM_NAMESPACE_TIMEOUT, PARAM_PARENT_NS, PARAM_PITFILE, PARAM_WORKSPACE, readParams } from "../src/bootstrap.js"
import { DEFAULT_CLUSTER_URL, DEFAULT_NAMESPACE_TIMEOUT } from "../src/config.js"

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
      PARAM_PARENT_NS, "dev"
     ])
  })

  it("readParams() should return populated config", () => {
    const config = readParams()
    chai.expect(config.workspace).eq("/my-test-workspace")
    chai.expect(config.pitfile).eq("/some-pitfile.yml")
    chai.expect(config.namespaceTimeoutSeconds).eq(100)
    chai.expect(config.clusterUrl).eq("http://some-host.name")
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

  it("readParams() should use default values", () => {
    sandbox.stub(process, 'argv').value([ "skip-first", "", PARAM_COMMIT_SHA, "abcdef1", PARAM_WORKSPACE, "/dir", PARAM_PARENT_NS, "dev" ])
    const config = readParams()
    chai.expect(config.namespaceTimeoutSeconds).eq(DEFAULT_NAMESPACE_TIMEOUT)
    chai.expect(config.clusterUrl).eq(DEFAULT_CLUSTER_URL)
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