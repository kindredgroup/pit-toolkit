import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
import * as sinon from "sinon"
chai.use(chaiAsPromised)

import * as PifFileLoader from "../../src/pitfile/pitfile-loader.js"
import { SchemaVersion as PifFileSchema } from "../../src/pitfile/version.js"

describe("Loads pitfile from disk", () => {
  const sandbox = sinon.createSandbox()

  it("should load pitfile from YML", async () => {
    //logger.info(process.cwd())

    const sandbox = sinon.createSandbox()
    const suffix = "some-branch-name"
    sandbox.stub(process, 'env').value({ "TEST_SUFFIX": suffix })

    const file = await PifFileLoader.loadFromFile("dist/test/pitfile/test-pitfile-valid-1.yml")
    chai.expect(file.projectName).eq("Tests for node-1 app")
    chai.expect(file.version).eq(PifFileSchema.VERSION_1_0)

    chai.expect(file.testSuites).lengthOf(3)
    chai.expect(file.testSuites[1].location.gitRef).eq(`refs/remotes/origin/${ suffix }`)
    chai.expect(file.testSuites[1].location.gitRepository).eq(`git://127.0.0.1:60100/example-project-${ suffix }.git`)
  })

  it("should load pitfile with incomplete sections", async () => {
    let file = await PifFileLoader.loadFromFile("dist/test/pitfile/test-pitfile-valid-2-incomplete.yml")
    chai.expect(file.testSuites).lengthOf(2)
    chai.expect(file.testSuites[0].location.gitRef).eq(`refs/remotes/origin/TEST_SUFFIX_NOT_FOUND`)
    chai.expect(file.testSuites[1].location.gitRef).eq(`refs/remotes/origin/master`)
    chai.expect(file.lockManager.id).eq("lock-manager")

    file = await PifFileLoader.loadFromFile("dist/test/pitfile/test-pitfile-valid-2-incomplete-tail-lm.yml")
    chai.expect(file.testSuites).lengthOf(2)
    chai.expect(file.testSuites[0].location.gitRef).eq(`refs/remotes/origin/TEST_SUFFIX_NOT_FOUND`)
    chai.expect(file.testSuites[1].location.gitRef).eq(`refs/remotes/origin/master`)
    chai.expect(file.lockManager.id).eq("lock-manager")
    chai.expect(file.lockManager.logTailing).not.undefined
    chai.expect(file.lockManager.logTailing.enabled).be.true
    chai.expect(file.lockManager.logTailing.containerName).eq(file.lockManager.id)
  })

  it("should throw if pitfile not found", async () => {
    await chai.expect(PifFileLoader.loadFromFile("does-not-exist.yml")).eventually.rejectedWith("There is no pitfile or it is not read")
  })

  it("should throw if location has no gitRemote", async () => {
    const errorMessage = `Invalid configuration for 'suite-1'. The 'location.gitRepository' is required when location.type is REMOTE`
    await chai.expect(PifFileLoader.loadFromFile("dist/test/pitfile/test-pitfile-valid-3-invalid.yml")).eventually.rejectedWith(errorMessage)
  })

  it("should load pitfile with dependsOn field", async () => {
    const file = await PifFileLoader.loadFromFile("dist/test/pitfile/test-pitfile-valid-with-dependencies.yml")
    chai.expect(file.projectName).eq("Dependency Test Example")
    chai.expect(file.testSuites).lengthOf(1)

    const testSuite = file.testSuites[0]
    chai.expect(testSuite.name).eq("Dependency Test Suite")
    chai.expect(testSuite.deployment.graph.components).lengthOf(4)

    const components = testSuite.deployment.graph.components
    const database = components.find(c => c.id === "database")
    const apiService = components.find(c => c.id === "api-service")
    const cache = components.find(c => c.id === "cache")
    const frontend = components.find(c => c.id === "frontend")

    chai.expect(database).not.undefined
    chai.expect(database!.dependsOn).undefined

    chai.expect(apiService).not.undefined
    chai.expect(apiService!.dependsOn).deep.equal(["database"])

    chai.expect(cache).not.undefined
    chai.expect(cache!.dependsOn).deep.equal(["database"])

    chai.expect(frontend).not.undefined
    chai.expect(frontend!.dependsOn).deep.equal(["api-service", "cache"])
  })

  it("should load pitfile with cyclic dependencies", async () => {
    const file = await PifFileLoader.loadFromFile("dist/test/pitfile/test-pitfile-invalid-with-cyclic-dependencies.yml")
    chai.expect(file.projectName).eq("Cyclic Dependency Test Example")
    chai.expect(file.testSuites).lengthOf(1)

    const testSuite = file.testSuites[0]
    chai.expect(testSuite.name).eq("Cyclic Dependency Test Suite")
    chai.expect(testSuite.deployment.graph.components).lengthOf(2)

    const components = testSuite.deployment.graph.components
    const componentA = components.find(c => c.id === "component-a")
    const componentB = components.find(c => c.id === "component-b")

    chai.expect(componentA).not.undefined
    chai.expect(componentA!.dependsOn).deep.equal(["component-b"])

    chai.expect(componentB).not.undefined
    chai.expect(componentB!.dependsOn).deep.equal(["component-a"])
  })

  after(() => {
    sandbox.restore()
  })

})
