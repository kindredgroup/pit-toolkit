import { describe, it } from "mocha"
import { expect } from "chai"
import {
  validateDependencies,
  detectCyclicDependencies,
  topologicalSort,
  reverseTopologicalSort
} from "../src/dependency-resolver.js"
import { Schema } from "../src/model.js"
import {
  CyclicDependencyError,
  DependencyValidationError
} from "../src/errors.js"

describe("Dependency Resolver", () => {
  describe("validateDependencies", () => {
    it("should pass validation for components without dependencies", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "component-a",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        },
        {
          name: "Component B",
          id: "component-b",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        }
      ]

      expect(() => validateDependencies(components, "test-suite")).not.to.throw()
    })

    it("should pass validation for valid dependencies", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Database",
          id: "database",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: []
        },
        {
          name: "API Service",
          id: "api-service",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["database"]
        }
      ]

      expect(() => validateDependencies(components, "test-suite")).not.to.throw()
    })

    it("should throw error for duplicate component IDs", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "duplicate-id",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        },
        {
          name: "Component B",
          id: "duplicate-id",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        }
      ]

      expect(() => validateDependencies(components, "test-suite")).to.throw(DependencyValidationError)
    })

    it("should throw error for self-dependency", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "component-a",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-a"]
        }
      ]

      expect(() => validateDependencies(components, "test-suite")).to.throw(DependencyValidationError)
    })

    it("should throw error for invalid dependency reference", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "component-a",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["non-existent-component"]
        }
      ]

      expect(() => validateDependencies(components, "test-suite")).to.throw(DependencyValidationError)
    })

    it("should throw error for cyclic dependencies", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "component-a",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-b"]
        },
        {
          name: "Component B",
          id: "component-b",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-a"]
        }
      ]

      expect(() => validateDependencies(components, "test-suite")).to.throw(DependencyValidationError)
    })
  })

  describe("detectCyclicDependencies", () => {
    it("should return undefined for no cycles", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Database",
          id: "database",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: []
        },
        {
          name: "API Service",
          id: "api-service",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["database"]
        }
      ]

      expect(detectCyclicDependencies(components)).to.be.undefined
    })

    it("should detect simple cycle", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "component-a",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-b"]
        },
        {
          name: "Component B",
          id: "component-b",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-a"]
        }
      ]

      const result = detectCyclicDependencies(components)
      expect(result).to.be.instanceOf(CyclicDependencyError)
      expect(result.cyclePath).to.deep.equal(["component-a", "component-b"])
    })

    it("should detect complex cycle", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "component-a",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-b"]
        },
        {
          name: "Component B",
          id: "component-b",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-c"]
        },
        {
          name: "Component C",
          id: "component-c",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["component-a"]
        }
      ]

      const result = detectCyclicDependencies(components)
      expect(result).to.be.instanceOf(CyclicDependencyError)
      expect(result.cyclePath).to.have.length(3)
      expect(result.cyclePath).to.include("component-a")
      expect(result.cyclePath).to.include("component-b")
      expect(result.cyclePath).to.include("component-c")
    })
  })

  describe("topologicalSort", () => {
    it("should sort components without dependencies in original order", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component A",
          id: "component-a",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        },
        {
          name: "Component B",
          id: "component-b",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        },
        {
          name: "Component C",
          id: "component-c",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        }
      ]

      const result = topologicalSort(components)
      expect(result.sortedComponents.map(c => c.id)).to.deep.equal(["component-a", "component-b", "component-c"])
    })

    it("should sort components with dependencies correctly", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "API Service",
          id: "api-service",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["database"]
        },
        {
          name: "Frontend",
          id: "frontend",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["api-service"]
        },
        {
          name: "Database",
          id: "database",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: []
        }
      ]

      const result = topologicalSort(components)
      expect(result.sortedComponents.map(c => c.id)).to.deep.equal(["database", "api-service", "frontend"])
    })

    it("should maintain original order for same-level components", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Database",
          id: "database",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: []
        },
        {
          name: "API Service",
          id: "api-service",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["database"]
        },
        {
          name: "Cache",
          id: "cache",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["database"]
        }
      ]

      const result = topologicalSort(components)
      expect(result.sortedComponents.map(c => c.id)).to.deep.equal(["database", "api-service", "cache"])
      expect(result.levels).to.have.length(2)
      expect(result.levels[0].map(c => c.id)).to.deep.equal(["database"])
      expect(result.levels[1].map(c => c.id)).to.deep.equal(["api-service", "cache"])
    })
  })

  describe("reverseTopologicalSort", () => {
    it("should reverse dependency levels but maintain order within levels", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Database",
          id: "database",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: []
        },
        {
          name: "API Service",
          id: "api-service",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["database"]
        },
        {
          name: "Frontend",
          id: "frontend",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["api-service"]
        },
        {
          name: "Cache",
          id: "cache",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" },
          dependsOn: ["database"]
        }
      ]

      const reverseResult = reverseTopologicalSort(topologicalSort(components))

      // Reverse levels only, but same order within level: frontend, api-service, cache, database
      expect(reverseResult.map(c => c.id)).to.deep.equal(["frontend", "api-service", "cache", "database"])
    })
  })
})
