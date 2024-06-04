import * as chai from "chai"

import { Config } from "../src/config.js"

describe("Tests for Config", () => {
  it("parseRetention (happy path)", () => {
    chai.expect(Config.parseRetention("1minute")).eq(1)
    chai.expect(Config.parseRetention("1minutes")).eq(1)
    chai.expect(Config.parseRetention("2minutes")).eq(2)
    chai.expect(Config.parseRetention("301minutes")).eq(301)

    chai.expect(Config.parseRetention("1hour")).eq(60)
    chai.expect(Config.parseRetention("2hours")).eq(120)

    chai.expect(Config.parseRetention("1day")).eq(24 * 60)
    chai.expect(Config.parseRetention("2days")).eq(24 * 60 * 2)
  })

  it("should catch invalid plurals and units", () => {
    chai.expect(() => Config.parseRetention("2minute")).to.throw("Invalid format for retention. Expected \"<digit><unit>\", got: 2minute")
    chai.expect(() => Config.parseRetention("2hour")).to.throw("Invalid format for retention. Expected \"<digit><unit>\", got: 2hour")
    chai.expect(() => Config.parseRetention("2day")).to.throw("Invalid format for retention. Expected \"<digit><unit>\", got: 2day")
    chai.expect(() => Config.parseRetention("2W")).to.throw("Invalid format for retention. Expected \"<digit><unit>\", got: 2W")
    chai.expect(() => Config.parseRetention("2")).to.throw("Invalid format for retention. Expected \"<digit><unit>\", got: 2")
  })

  it("isModuleEnabled", () => {
    chai.expect(Config.isModuleEnabled("abc, xyz", "abc")).be.true
    chai.expect(Config.isModuleEnabled("abc, xyz", "xyz")).be.true
    chai.expect(Config.isModuleEnabled("abc, xyz", "klm")).be.false
  })

})