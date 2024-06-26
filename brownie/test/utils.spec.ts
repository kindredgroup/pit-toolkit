import * as chai from "chai"
import * as sinon from "sinon"

import * as utils from "../src/utils.js"

const PATTERN = new RegExp(/^.*pit.*(ts[0-9]{14,14}).*/)

describe("Tests for evaluateResource()", () => {
  it("evaluateResource (happy path)", () => {
    const now = new Date("2024-03-01T10:11:12.00Z")
    const o = (v: string) => v.replaceAll(" ", "").replaceAll(":", "")
    chai.expect(utils.evaluateResource(o("some-name_pit-ns_ts 2024 03 01 10:09:11"), PATTERN, now, 2)).eq(utils.ResourceStatus.CLEAN)
    chai.expect(utils.evaluateResource(o("some-name_pit-ns_ts 2024 03 01 10:09:12"), PATTERN, now, 2)).eq(utils.ResourceStatus.RETAIN)
    chai.expect(utils.evaluateResource(o("some-name_pit-ns_ts 2024 03 01 10:11:10"), PATTERN, now, 2)).eq(utils.ResourceStatus.RETAIN)
    chai.expect(utils.evaluateResource(o("name_nomatch 2024 03 01 10:09:11"), PATTERN, now, 2)).eq(utils.ResourceStatus.SKIP)
  })

  it("should catch invalid year", () => {
    const now = new Date("2024-03-01T10:11:12.00Z")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20230301100911", PATTERN, now, 2)).to.throw("Invalid year value: 2023. Expected 2024 or later")
  })

  it("should catch invalid month", () => {
    const now = new Date("2024-03-01T10:11:12.00Z")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20241301100911", PATTERN, now, 2)).to.throw("Invalid month value: 13. Expected digit from 1 to 12")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240001100911", PATTERN, now, 2)).to.throw("Invalid month value: 0. Expected digit from 1 to 12")
  })

  it("should catch invalid day", () => {
    const now = new Date("2024-03-01T10:11:12.00Z")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240300100911", PATTERN, now, 2)).to.throw("Invalid day value: 0. Expected digit from 1 to 31")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240332100911", PATTERN, now, 2)).to.throw("Invalid day value: 32. Expected digit from 1 to 31")
  })

  it("should catch invalid hours", () => {
    const now = new Date("2024-03-01T10:11:12.00Z")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240301250911", PATTERN, now, 2)).to.throw("Invalid hours value: 25. Expected digit from 0 to 23")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240301240911", PATTERN, now, 2)).to.throw("Invalid hours value: 24. Expected digit from 0 to 23")
  })

  it("should catch invalid minutes", () => {
    const now = new Date("2024-03-01T10:11:12.00Z")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240301106011", PATTERN, now, 2)).to.throw("Invalid minutes value: 60. Expected digit from 0 to 59")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240301106111", PATTERN, now, 2)).to.throw("Invalid minutes value: 61. Expected digit from 0 to 59")
  })

  it("should catch invalid seconds", () => {
    const now = new Date("2024-03-01T10:11:12.00Z")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240301101160", PATTERN, now, 2)).to.throw("Invalid seconds value: 60. Expected digit from 0 to 59")
    chai.expect(() => utils.evaluateResource("some-name_pit-ns_ts20240301101161", PATTERN, now, 2)).to.throw("Invalid seconds value: 61. Expected digit from 0 to 59")
  })
})

describe("Tests for readParameterValue()", () => {
  const sandbox = sinon.createSandbox()

  afterEach(() => {
    sandbox.restore()
  })

  it("should take param value from the loaded list", () => {
    const loadedParams = new Map([ [ "--param-one", "value1" ], [ "--param-two", "value2" ] ])
    chai.expect(utils.readParameterValue(loadedParams, "--param-one")).eq("value1")
    chai.expect(utils.readParameterValue(loadedParams, "--param-two")).eq("value2")
  })

  it("should ignore optional param", () => {
    const loadedParams = new Map([ [ "--param-two", "value2" ] ])
    chai.expect(utils.readParameterValue(loadedParams, "--param-one", false)).is.undefined
    chai.expect(utils.readParameterValue(loadedParams, "--param-one", false, "some-default")).is.undefined
    chai.expect(utils.readParameterValue(loadedParams, "--param-two")).eq("value2")
  })

  it("should fallback to default value", () => {
    const loadedParams = new Map([ [ "--param-two", "value2" ] ])
    chai.expect(utils.readParameterValue(loadedParams, "--param-one", true, "value1-default")).eq("value1-default")
    chai.expect(utils.readParameterValue(loadedParams, "--param-two")).eq("value2")
  })

  it("should fallback to environment variable", () => {
    const loadedParams = new Map([ [ "--param-one", "value1" ], [ "--param-two", "value2" ] ])
    const env = []
    env["PARAM_ONE"] = "value1-from-env"
    env["PARAM_THREE"] = "value3-from-env"
    sandbox.stub(process, "env").value(env)
    chai.expect(utils.readParameterValue(loadedParams, "--param-one")).eq("value1")
    chai.expect(utils.readParameterValue(loadedParams, "--param-two")).eq("value2")
    chai.expect(utils.readParameterValue(loadedParams, "--param-three")).eq("value3-from-env")
  })

  it("should throw if required param is missing", () => {
    const loadedParams = new Map([ [ "--param-two", "value2" ] ])
    chai.expect(() => utils.readParameterValue(loadedParams, "--param-one", true)).throws(`Missing required parameter "--param-one" or env variable: PARAM_ONE`)
  })
})
