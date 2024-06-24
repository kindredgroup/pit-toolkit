import * as chai from "chai"

import { Config, parseModules } from "../src/config.js"

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

  it("should parse module config", () => {
    const modules = parseModules("postgresql=server1;server2, kafka=kserver1; kserver2; kserver3")
    chai.expect(modules).be.not.null
    chai.expect(modules).be.not.undefined
    chai.expect(modules.size).eq(2)
    chai.expect(modules.has("postgresql")).be.true
    chai.expect(modules.get("postgresql").name).eq("postgresql")
    chai.expect(modules.get("postgresql").ids).be.not.null
    chai.expect(modules.get("postgresql").ids).be.not.undefined
    chai.expect(modules.get("postgresql").ids).deep.eq([ "server1", "server2" ])

    chai.expect(modules.has("kafka")).be.true
    chai.expect(modules.get("kafka").name).eq("kafka")
    chai.expect(modules.get("kafka").ids).be.not.null
    chai.expect(modules.get("kafka").ids).be.not.undefined
    chai.expect(modules.get("kafka").ids).deep.eq([ "kserver1", "kserver2", "kserver3" ])
  })

  it("should thorw too many modules error", () => {
    chai.expect(() => parseModules("m1,m2,m3,m4,m5,m6")).to.throw("Invalid format for modules. We only support up to 5 modules: m1,m2,m3,m4,m5,m")
  })
  it("should thorw invalid module format", () => {
    chai.expect(() => parseModules("m1=,m2")).to.throw("Invalid format for module config. The correct example is: modue=id1;id2;id3 Current value is: m1=")
    chai.expect(() => parseModules("m1=;;,m2")).to.throw("Invalid format of module ids. The correct example is: modue=id1;id2;id3 Current value is: m1=")
    chai.expect(() => parseModules("m1=s1;s2;s1,m2")).to.throw("Invalid format of module ids. Values must be unique. The correct example is: modue=id1;id2;id3 Current value is: m1=s1;s2;s1")
    chai.expect(() => parseModules("m1=s1;s2,m2")).to.throw("Unsupported module name: m1. We only support the following modules: postgresql,kafka")
    chai.expect(() => parseModules("kafka=s1;s2,postgresql,kafka")).to.throw("Invalid format of module names. Values must be unique. The correct example is: \"module1=id1;id2;id3, module2\" Current value is: kafka=s1;s2,postgresql,kafka")
  })
})