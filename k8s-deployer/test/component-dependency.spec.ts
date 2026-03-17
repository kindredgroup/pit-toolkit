import { describe, it } from "mocha"
import { expect } from "chai"
import * as path from "path"
import { fileURLToPath } from "url"
import * as PifFileLoader from "../src/pitfile/pitfile-loader.js"
import { validateDependencies, topologicalSort, reverseTopologicalSort } from "../src/dependency-resolver.js"
import { DependencyValidationError, CyclicDependencyError } from "../src/errors.js"
import { Schema } from "../src/model.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe("Component Dependency Tests", () => {
  describe("Valid Dependencies", () => {
    it("should validate and sort components with valid dependencies", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-with-dependencies.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      const testSuite = pitfile.testSuites[0]
      const components = testSuite.deployment.graph.components

      // Should not throw validation error
      expect(() => validateDependencies(components, testSuite.name)).not.to.throw()

      // Test topological sorting
      const sortResult = topologicalSort(components)
      const sortedIds = sortResult.sortedComponents.map(c => c.id)

      // Expected order: database -> api-service, cache -> frontend
      expect(sortedIds).to.deep.equal(["database", "api-service", "cache", "frontend"])

      // Test levels
      expect(sortResult.levels).to.have.length(3)
      expect(sortResult.levels[0].map(c => c.id)).to.deep.equal(["database"])
      expect(sortResult.levels[1].map(c => c.id)).to.deep.equal(["api-service", "cache"])
      expect(sortResult.levels[2].map(c => c.id)).to.deep.equal(["frontend"])

      // Test reverse sorting for undeployment
      const reverseSorted = reverseTopologicalSort(sortResult)
      const reverseIds = reverseSorted.map(c => c.id)

      // Expected undeployment order: frontend -> api-service, cache -> database
      expect(reverseIds).to.deep.equal(["frontend", "api-service", "cache", "database"])
    })

    it("should handle components without dependsOn field (backward compatibility)", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-without-dependencies.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      const testSuite = pitfile.testSuites[0]
      const components = testSuite.deployment.graph.components

      // Should not throw validation error
      expect(() => validateDependencies(components, testSuite.name)).not.to.throw()

      // Should maintain original order
      const sortResult = topologicalSort(components)
      expect(sortResult.sortedComponents.map(c => c.id)).to.deep.equal(["component-a", "component-b", "component-c"])
    })
  })

  describe("Cyclic Dependencies", () => {
    it("should detect and report cyclic dependencies", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-invalid-with-cyclic-dependencies.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      const testSuite = pitfile.testSuites[0]
      const components = testSuite.deployment.graph.components

      // Should throw validation error
      expect(() => validateDependencies(components, testSuite.name)).to.throw(DependencyValidationError)

      try {
        validateDependencies(components, testSuite.name)
      } catch (error) {
        expect(error).to.be.instanceOf(DependencyValidationError)
        expect(error.errors).to.have.length(1)
        expect(error.errors[0]).to.be.instanceOf(CyclicDependencyError)

        const cyclicError = error.errors[0] as CyclicDependencyError
        expect(cyclicError.cyclePath).to.deep.equal(["component-a", "component-b"])
      }
    })
  })

  describe("Parallel Deploy Flag", () => {
    it("should load and sort components with parallel deploy flag set", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-with-parallel-deploy.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      const testSuite = pitfile.testSuites[0]
      const components = testSuite.deployment.graph.components

      // Should validate successfully
      expect(() => validateDependencies(components, testSuite.name)).not.to.throw()

      const sortResult = topologicalSort(components)

      // Level 0: no dependencies — database, message-queue, config-service, metrics-collector
      expect(sortResult.levels[0].map(c => c.id)).to.deep.equal([
        "database", "message-queue", "config-service", "metrics-collector"
      ])

      // Level 1: api-service (depends on database + message-queue), cache-service (depends on database)
      expect(sortResult.levels[1].map(c => c.id)).to.deep.equal(["api-service", "cache-service"])

      // Level 2: backend-for-frontend (depends on api-service + cache-service)
      expect(sortResult.levels[2].map(c => c.id)).to.deep.equal(["backend-for-frontend"])

      // Level 3: frontend (depends on backend-for-frontend)
      expect(sortResult.levels[3].map(c => c.id)).to.deep.equal(["frontend"])

      // Parallel flags are preserved through sorting
      const db = components.find(c => c.id === "database")!
      const configService = components.find(c => c.id === "config-service")!
      const apiService = components.find(c => c.id === "api-service")!
      const cacheService = components.find(c => c.id === "cache-service")!

      expect(db.deploy.parallel).to.be.true
      expect(apiService.deploy.parallel).to.be.true
      expect(configService.deploy.parallel).to.be.undefined  // sequential
      expect(cacheService.deploy.parallel).to.be.undefined   // sequential, despite depending on a parallel component
    })

    it("testApp parallel flag is independent of component parallel flags", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-with-parallel-deploy.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      const testSuite = pitfile.testSuites[0]

      expect(testSuite.deployment.graph.testApp.deploy.parallel).to.be.true
    })

    it("multi-stage graph: mixed parallel/sequential at every level, cross-stage ancestry, fan-in convergence", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-with-parallel-subgroups.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      // Suite index 1: multi-stage-mixed
      const testSuite = pitfile.testSuites[1]
      const components = testSuite.deployment.graph.components

      expect(() => validateDependencies(components, testSuite.name)).not.to.throw()

      const sortResult = topologicalSort(components)
      expect(sortResult.levels).to.have.length(5)

      // Stage 0: two independent roots — Infra (parallel) and Config (sequential)
      expect(sortResult.levels[0].map(c => c.id)).to.deep.equal(["infra", "config"])
      expect(components.find(c => c.id === "infra")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "config")!.deploy.parallel).to.be.undefined

      // Stage 1: Auth🔀, Cache🔀 depend only on Infra; Registry depends on both roots (sequential)
      expect(sortResult.levels[1].map(c => c.id)).to.deep.equal(["auth", "cache", "registry"])
      expect(components.find(c => c.id === "auth")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "cache")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "registry")!.deploy.parallel).to.be.undefined
      // Registry's cross-stage ancestry: depends on both stage-0 nodes
      expect(components.find(c => c.id === "registry")!.dependsOn).to.deep.equal(["infra", "config"])

      // Stage 2: API🔀 (Auth+Cache), Worker🔀 (Cache+Registry — one parallel, one sequential parent), Scheduler (Registry)
      expect(sortResult.levels[2].map(c => c.id)).to.deep.equal(["api", "worker", "scheduler"])
      expect(components.find(c => c.id === "api")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "worker")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "scheduler")!.deploy.parallel).to.be.undefined
      expect(components.find(c => c.id === "worker")!.dependsOn).to.deep.equal(["cache", "registry"])

      // Stage 3: Gateway — sequential fan-in from all three stage-2 nodes
      expect(sortResult.levels[3].map(c => c.id)).to.deep.equal(["gateway"])
      expect(components.find(c => c.id === "gateway")!.deploy.parallel).to.be.undefined
      expect(components.find(c => c.id === "gateway")!.dependsOn).to.deep.equal(["api", "worker", "scheduler"])

      // Stage 4: Frontend🔀 and Admin🔀 both depend on Gateway
      expect(sortResult.levels[4].map(c => c.id)).to.deep.equal(["frontend", "admin"])
      expect(components.find(c => c.id === "frontend")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "admin")!.deploy.parallel).to.be.true

      // Undeployment: reverse stages, within each stage order is preserved
      const undeployOrder = reverseTopologicalSort(sortResult).map(c => c.id)
      expect(undeployOrder).to.deep.equal([
        "frontend", "admin",
        "gateway",
        "api", "worker", "scheduler",
        "auth", "cache", "registry",
        "infra", "config"
      ])

      // testApp is marked parallel (runs concurrently with component stages)
      expect(testSuite.deployment.graph.testApp.deploy.parallel).to.be.true
    })

    it("A -> [B🔀, C🔀, D🔀] -> E: all middle components parallel, flanked by sequential nodes", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-with-parallel-subgroups.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      // Suite index 0: all-parallel-middle
      const testSuite = pitfile.testSuites[0]
      const components = testSuite.deployment.graph.components

      expect(() => validateDependencies(components, testSuite.name)).not.to.throw()

      const sortResult = topologicalSort(components)

      // Level 0: A (no dependencies, sequential)
      expect(sortResult.levels[0].map(c => c.id)).to.deep.equal(["node-a"])
      expect(components.find(c => c.id === "node-a")!.deploy.parallel).to.be.undefined

      // Level 1: B, C, D (all depend on A, all parallel)
      expect(sortResult.levels[1].map(c => c.id)).to.deep.equal(["node-b", "node-c", "node-d"])
      expect(components.find(c => c.id === "node-b")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "node-c")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "node-d")!.deploy.parallel).to.be.true

      // Level 2: E (depends on B, C, D — sequential)
      expect(sortResult.levels[2].map(c => c.id)).to.deep.equal(["node-e"])
      expect(components.find(c => c.id === "node-e")!.deploy.parallel).to.be.undefined

      // Undeployment reverses: E -> B,C,D -> A
      const undeployOrder = reverseTopologicalSort(sortResult).map(c => c.id)
      expect(undeployOrder).to.deep.equal(["node-e", "node-b", "node-c", "node-d", "node-a"])
    })

    it("A -> [B🔀, C🔀, D] -> E: mixed parallel/sequential middle layer, E depends on all three", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-with-parallel-subgroups.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      // Suite index 2: mixed-parallel-middle
      const testSuite = pitfile.testSuites[2]
      const components = testSuite.deployment.graph.components

      expect(() => validateDependencies(components, testSuite.name)).not.to.throw()

      const sortResult = topologicalSort(components)

      // Level 0: A
      expect(sortResult.levels[0].map(c => c.id)).to.deep.equal(["node-a"])

      // Level 1: B, C, D — same dependency level; B and C parallel, D sequential
      expect(sortResult.levels[1].map(c => c.id)).to.deep.equal(["node-b", "node-c", "node-d"])
      expect(components.find(c => c.id === "node-b")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "node-c")!.deploy.parallel).to.be.true
      expect(components.find(c => c.id === "node-d")!.deploy.parallel).to.be.undefined  // sequential

      // Level 2: E (waits for all of B, C and D)
      expect(sortResult.levels[2].map(c => c.id)).to.deep.equal(["node-e"])
      expect(components.find(c => c.id === "node-e")!.deploy.parallel).to.be.undefined

      // Undeployment reverses: E -> B,C,D -> A
      const undeployOrder = reverseTopologicalSort(sortResult).map(c => c.id)
      expect(undeployOrder).to.deep.equal(["node-e", "node-b", "node-c", "node-d", "node-a"])
    })
  })

  describe("Complex Dependency Scenarios", () => {
    it("should handle complex dependency graphs correctly", async () => {
      const pitfilePath = path.join(__dirname, "pitfile", "test-pitfile-valid-with-complex-dependencies.yml")
      const pitfile = await PifFileLoader.loadFromFile(pitfilePath)
      const testSuite = pitfile.testSuites[0]
      const components = testSuite.deployment.graph.components

      // Should validate successfully
      expect(() => validateDependencies(components, testSuite.name)).not.to.throw()

      // Test deployment order
      const sortResult = topologicalSort(components)
      const deploymentOrder = sortResult.sortedComponents.map(c => c.id)

      // Expected deployment order:
      // database, message-queue -> api-service, cache-service, task-worker -> backend for frontend -> frontend
      expect(deploymentOrder).to.deep.equal([
        "database", "message-queue",
        "api-service", "cache-service", "task-worker",
        "backend-for-frontend",
        "frontend"
      ])

      // Test undeployment order
      const undeploymentOrder = reverseTopologicalSort(sortResult).map(c => c.id)

      // Expected undeployment order:
      // frontend -> backend for frontend -> api-service, cache-service, task-worker -> database, message-queue
      expect(undeploymentOrder).to.deep.equal([
        "frontend",
        "backend-for-frontend",
        "api-service", "cache-service", "task-worker",
        "database", "message-queue"
      ])

      // Verify levels
      expect(sortResult.levels).to.have.length(4)
      expect(sortResult.levels[0].map(c => c.id)).to.deep.equal(["database", "message-queue"])
      expect(sortResult.levels[1].map(c => c.id)).to.deep.equal(["api-service", "cache-service", "task-worker"])
      expect(sortResult.levels[2].map(c => c.id)).to.deep.equal(["backend-for-frontend"])
      expect(sortResult.levels[3].map(c => c.id)).to.deep.equal(["frontend"])
    })
  })
})
