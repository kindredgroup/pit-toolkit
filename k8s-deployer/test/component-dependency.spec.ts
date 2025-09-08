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
