import * as chai from "chai"
import * as sinon from "sinon"
import { readParameterValue } from "../src/bootrstrap.js"

describe("Tests for readParameterValue()", () => {
  const sandbox = sinon.createSandbox()

  afterEach(() => {
    sandbox.restore()
  })

  it("should take param value from the loaded list", () => {
    const loadedParams = new Map([ [ "--param-one", "value1" ], [ "--param-two", "value2" ] ])
    chai.expect(readParameterValue(loadedParams, "--param-one")).eq("value1")
    chai.expect(readParameterValue(loadedParams, "--param-two")).eq("value2")
  })

  it("should ignore optional param", () => {
    const loadedParams = new Map([ [ "--param-two", "value2" ] ])
    chai.expect(readParameterValue(loadedParams, "--param-one", false)).is.undefined
    chai.expect(readParameterValue(loadedParams, "--param-one", false, "some-default")).is.undefined
    chai.expect(readParameterValue(loadedParams, "--param-two")).eq("value2")
  })

  it("should fallback to default value", () => {
    const loadedParams = new Map([ [ "--param-two", "value2" ] ])
    chai.expect(readParameterValue(loadedParams, "--param-one", true, "value1-default")).eq("value1-default")
    chai.expect(readParameterValue(loadedParams, "--param-two")).eq("value2")
  })

  it("should fallback to environment variable", () => {
    const loadedParams = new Map([ [ "--param-one", "value1" ], [ "--param-two", "value2" ] ])
    const env = []
    env["PARAM_ONE"] = "value1-from-env"
    env["PARAM_THREE"] = "value3-from-env"
    sandbox.stub(process, "env").value(env)
    chai.expect(readParameterValue(loadedParams, "--param-one")).eq("value1")
    chai.expect(readParameterValue(loadedParams, "--param-two")).eq("value2")
    chai.expect(readParameterValue(loadedParams, "--param-three")).eq("value3-from-env")
  })

  it("should throw if required param is missing", () => {
    const loadedParams = new Map([ [ "--param-two", "value2" ] ])
    chai.expect(() => readParameterValue(loadedParams, "--param-one", true)).throws(`Missing required parameter "--param-one" or env variable: PARAM_ONE`)
  })
})
