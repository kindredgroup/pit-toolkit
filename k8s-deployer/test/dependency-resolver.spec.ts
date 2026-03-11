import { describe, it } from "mocha"
import { expect } from "chai"
import {
  validateDependencies,
  detectCyclicDependencies,
  topologicalSort,
  reverseTopologicalSort,
  printDependencyGraph
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

    it("should preserve original order if no dependsOn fields are present", () => {
      const components: Array<Schema.DeployableComponent> = [
        {
          name: "Component X",
          id: "component-x",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        },
        {
          name: "Component Y",
          id: "component-y",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        },
        {
          name: "Component Z",
          id: "component-z",
          location: { type: Schema.LocationType.Local },
          deploy: { command: "deploy.sh" },
          undeploy: { command: "undeploy.sh" }
        }
      ]

      const result = topologicalSort(components)
      expect(result.sortedComponents.map(c => c.id)).to.deep.equal(["component-x", "component-y", "component-z"])
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

  describe("printDependencyGraph", () => {
    let logOutput: string[]
    let originalLog: typeof console.log
    const testApp: Schema.DeployableComponent = {
      name: "test-app", id: "test-app",
      location: { type: Schema.LocationType.Local },
      deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }
    }
    beforeEach(() => {
      logOutput = []
      originalLog = console.log
      console.log = (msg?: any) => logOutput.push(String(msg))
    })
    afterEach(() => {
      console.log = originalLog
    })

    it("prints graph for components without dependencies", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      expect(logOutput).to.include("  Stage 1 │  a  b  c")
      expect(logOutput).to.include("  Stage 2 │  test-app")
    })

    it("prints graph for components with dependencies at multiple stages", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "DB", id: "db", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: [] },
        { name: "API", id: "api", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["db"] },
        { name: "Cache", id: "cache", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["db"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      expect(logOutput).to.include("  Stage 1 │  db")
      expect(logOutput).to.include("  Stage 2 │  api  cache")
      expect(logOutput).to.include("  Stage 3 │  test-app")
      expect(logOutput).to.include("  db ──▶ api")
      expect(logOutput).to.include("  db ──▶ cache")
    })

    it("prints graph for chained dependencies", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: [] },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["b"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  b")
      expect(logOutput).to.include("  Stage 3 │  c")
      expect(logOutput).to.include("  Stage 4 │  test-app")
      expect(logOutput).to.include("  a ──▶ b")
      expect(logOutput).to.include("  b ──▶ c")
    })

    it("annotates parallel components with 🔀 and prints a legend", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  [b 🔀  c 🔀]")
      expect(logOutput).to.include("  Stage 3 │  test-app")
      expect(logOutput).to.include("  a ──▶ b")
      expect(logOutput).to.include("  a ──▶ c")
      expect(logOutput).to.include("  🔀 = concurrent deployment")
    })

    it("shows mixed parallel/sequential at same level as [parallel] → sequential", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  [b 🔀] → c")
      expect(logOutput).to.include("  Stage 3 │  test-app")
      expect(logOutput).to.include("  🔀 = concurrent deployment")
    })

    it("shows testApp in a concurrent section when testApp.parallel is true", () => {
      const parallelTestApp: Schema.DeployableComponent = { ...testApp, id: "my-test-app", deploy: { ...testApp.deploy, parallel: true } }
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] }
      ]
      printDependencyGraph({ testApp: parallelTestApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  b")
      expect(logOutput).to.include("  my-test-app 🔀  (concurrent with component stages)")
      expect(logOutput).to.not.include("  Stage 3 │  my-test-app")
      expect(logOutput).to.include("  🔀 = concurrent deployment")
    })
  })
})
