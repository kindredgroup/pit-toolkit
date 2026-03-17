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
    let originalDebug: typeof console.debug
    const testApp: Schema.DeployableComponent = {
      name: "test-app", id: "test-app",
      location: { type: Schema.LocationType.Local },
      deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }
    }
    beforeEach(() => {
      logOutput = []
      originalLog = console.log
      originalDebug = console.debug
      console.log = (msg?: any) => logOutput.push(String(msg))
      console.debug = () => {}
    })
    afterEach(() => {
      console.log = originalLog
      console.debug = originalDebug
    })

    it("prints graph for components without dependencies", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  a  b  c")
      expect(logOutput).to.include("  Stage 2 │  test-app")
      // ASCII art: box lines contain each node id
      expect(logOutput.some(l => l.includes("│") && l.includes(" a "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes(" b "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes(" c "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("test-app"))).to.be.true
    })

    it("prints graph for components with dependencies at multiple stages", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "DB", id: "db", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: [] },
        { name: "API", id: "api", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["db"] },
        { name: "Cache", id: "cache", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["db"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  db")
      expect(logOutput).to.include("  Stage 2 │  api  cache")
      expect(logOutput).to.include("  Stage 3 │  test-app")
      // ASCII art
      expect(logOutput.some(l => l.includes("│") && l.includes("db"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("api"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("cache"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("test-app"))).to.be.true
    })

    it("prints graph for chained dependencies", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: [] },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["b"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  b")
      expect(logOutput).to.include("  Stage 3 │  c")
      expect(logOutput).to.include("  Stage 4 │  test-app")
      // ASCII art
      expect(logOutput.some(l => l.includes("│") && l.includes(" a "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes(" b "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes(" c "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("test-app"))).to.be.true
    })

    it("annotates parallel components with 🔀 and prints a legend", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  [b 🔀  c 🔀]")
      expect(logOutput).to.include("  Stage 3 │  test-app")
      // ASCII art: parallel nodes have _🔀 suffix in their box label
      expect(logOutput.some(l => l.includes("│") && l.includes(" a "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("b_🔀"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("c_🔀"))).to.be.true
    })

    it("shows mixed parallel/sequential at same level as [parallel] → sequential", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] },
        { name: "C", id: "c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] }
      ]
      printDependencyGraph({ testApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  [b 🔀] → c")
      expect(logOutput).to.include("  Stage 3 │  test-app")
      // ASCII art
      expect(logOutput.some(l => l.includes("│") && l.includes(" a "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("b_🔀"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes(" c "))).to.be.true
    })

    it("shows testApp in a concurrent section when testApp.parallel is true", () => {
      const parallelTestApp: Schema.DeployableComponent = { ...testApp, id: "my-test-app", deploy: { ...testApp.deploy, parallel: true } }
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["a"] }
      ]
      printDependencyGraph({ testApp: parallelTestApp, components })
      expect(logOutput[0]).to.equal("Dependency Graph")
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  a")
      expect(logOutput).to.include("  Stage 2 │  b")
      expect(logOutput).to.include("  my-test-app 🔀  (concurrent with component stages)")
      expect(logOutput).to.not.include("  Stage 3 │  my-test-app")
      // ASCII art: testApp does NOT appear as a box (it's concurrent)
      expect(logOutput.some(l => l.includes("│") && l.includes("my-test-app"))).to.be.false
      expect(logOutput.some(l => l.includes("│") && l.includes(" a "))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes(" b "))).to.be.true
    })

    it("A -> [B🔀, C🔀, D🔀] -> E: parallel middle layer shown in stage list brackets, ASCII art has _🔀 labels", () => {
      const parallelTestApp: Schema.DeployableComponent = { ...testApp, deploy: { ...testApp.deploy, parallel: true } }
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "node-a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "node-b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-a"] },
        { name: "C", id: "node-c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-a"] },
        { name: "D", id: "node-d", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-a"] },
        { name: "E", id: "node-e", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-b", "node-c", "node-d"] }
      ]
      printDependencyGraph({ testApp: parallelTestApp, components })
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  node-a")
      expect(logOutput).to.include("  Stage 2 │  [node-b 🔀  node-c 🔀  node-d 🔀]")
      expect(logOutput).to.include("  Stage 3 │  node-e")
      // testApp concurrent
      expect(logOutput).to.include("  test-app 🔀  (concurrent with component stages)")
      expect(logOutput).to.not.include("  Stage 4 │  test-app")
      // ASCII art: parallel nodes use _🔀 suffix; sequential node-a and node-e are plain
      expect(logOutput.some(l => l.includes("│") && l.includes("node-a"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("node-b_🔀"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("node-c_🔀"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("node-d_🔀"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("node-e"))).to.be.true
    })

    it("A -> [B🔀, C🔀, D] -> E: mixed middle layer shown as [parallel] → sequential in stage list", () => {
      const components: Array<Schema.DeployableComponent> = [
        { name: "A", id: "node-a", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" } },
        { name: "B", id: "node-b", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-a"] },
        { name: "C", id: "node-c", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-a"] },
        { name: "D", id: "node-d", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-a"] },
        { name: "E", id: "node-e", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" }, undeploy: { command: "undeploy.sh" }, dependsOn: ["node-b", "node-c", "node-d"] }
      ]
      printDependencyGraph({ testApp, components })
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  node-a")
      expect(logOutput).to.include("  Stage 2 │  [node-b 🔀  node-c 🔀] → node-d")
      expect(logOutput).to.include("  Stage 3 │  node-e")
      expect(logOutput).to.include("  Stage 4 │  test-app")
      // ASCII art
      expect(logOutput.some(l => l.includes("│") && l.includes("node-b_🔀"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("node-c_🔀"))).to.be.true
      expect(logOutput.some(l => l.includes("│") && l.includes("node-d"))).to.be.true
    })

    it("multi-stage graph: stage list and ASCII art correct, concurrent testApp banner, cross-ancestry edges", () => {
      const parallelTestApp: Schema.DeployableComponent = { ...testApp, id: "test-app", deploy: { ...testApp.deploy, parallel: true } }
      const components: Array<Schema.DeployableComponent> = [
        { name: "Infra",    id: "infra",    location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" } },
        { name: "Config",   id: "config",   location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" },                 undeploy: { command: "undeploy.sh" } },
        { name: "Auth",     id: "auth",     location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["infra"] },
        { name: "Cache",    id: "cache",    location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["infra"] },
        { name: "Registry", id: "registry", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" },                 undeploy: { command: "undeploy.sh" }, dependsOn: ["infra", "config"] },
        { name: "API",       id: "api",       location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["auth", "cache"] },
        { name: "Worker",    id: "worker",    location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["cache", "registry"] },
        { name: "Scheduler", id: "scheduler", location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" },                 undeploy: { command: "undeploy.sh" }, dependsOn: ["registry"] },
        { name: "Gateway",   id: "gateway",   location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh" },                 undeploy: { command: "undeploy.sh" }, dependsOn: ["api", "worker", "scheduler"] },
        { name: "Frontend",  id: "frontend",  location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["gateway"] },
        { name: "Admin",     id: "admin",     location: { type: Schema.LocationType.Local }, deploy: { command: "deploy.sh", parallel: true }, undeploy: { command: "undeploy.sh" }, dependsOn: ["gateway"] }
      ]
      printDependencyGraph({ testApp: parallelTestApp, components })
      // Stage list
      expect(logOutput).to.include("  Stage 1 │  [infra 🔀] → config")
      expect(logOutput).to.include("  Stage 2 │  [auth 🔀  cache 🔀] → registry")
      expect(logOutput).to.include("  Stage 3 │  [api 🔀  worker 🔀] → scheduler")
      expect(logOutput).to.include("  Stage 4 │  gateway")
      expect(logOutput).to.include("  Stage 5 │  [frontend 🔀  admin 🔀]")
      // testApp concurrent
      expect(logOutput).to.include("  test-app 🔀  (concurrent with component stages)")
      // ASCII art: all node ids appear in box lines
      for (const id of ["infra_🔀", "config", "auth_🔀", "cache_🔀", "registry", "api_🔀", "worker_🔀", "scheduler", "gateway", "frontend_🔀", "admin_🔀"]) {
        expect(logOutput.some(l => l.includes("│") && l.includes(id)), `expected box for ${id}`).to.be.true
      }
    })
  })
})
