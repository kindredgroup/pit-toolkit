import { describe, it } from "mocha"
import { expect } from "chai"
import {
  CyclicDependencyError,
  InvalidDependencyError,
  SelfDependencyError,
  DuplicateComponentIdError,
  DependencyValidationError
} from "../src/errors.js"

describe("Error Classes", () => {
  describe("CyclicDependencyError", () => {
    it("should create error with cycle path", () => {
      const cyclePath = ["component-a", "component-b", "component-c"]
      const error = new CyclicDependencyError(cyclePath, "component-a")

      expect(error.name).to.equal("CyclicDependencyError")
      expect(error.message).to.equal("Cyclic dependency detected: component-a → component-b → component-c → component-a")
      expect(error.cyclePath).to.deep.equal(cyclePath)
      expect(error.componentId).to.equal("component-a")
    })
  })

  describe("InvalidDependencyError", () => {
    it("should create error with component and invalid dependency", () => {
      const error = new InvalidDependencyError("component-a", "non-existent")

      expect(error.name).to.equal("InvalidDependencyError")
      expect(error.message).to.equal("Component component-a references non-existent component non-existent")
      expect(error.componentId).to.equal("component-a")
      expect(error.invalidDependency).to.equal("non-existent")
    })
  })

  describe("SelfDependencyError", () => {
    it("should create error with component ID", () => {
      const error = new SelfDependencyError("component-a")

      expect(error.name).to.equal("SelfDependencyError")
      expect(error.message).to.equal("Component component-a cannot depend on itself")
      expect(error.componentId).to.equal("component-a")
    })
  })

  describe("DuplicateComponentIdError", () => {
    it("should create error with duplicate component ID", () => {
      const error = new DuplicateComponentIdError("duplicate-id")

      expect(error.name).to.equal("DuplicateComponentIdError")
      expect(error.message).to.equal("Duplicate component ID duplicate-id found")
      expect(error.componentId).to.equal("duplicate-id")
    })
  })

  describe("DependencyValidationError", () => {
    it("should create error with test suite name and errors", () => {
      const errors = [
        new InvalidDependencyError("component-a", "non-existent"),
        new SelfDependencyError("component-b")
      ]
      const error = new DependencyValidationError("test-suite", errors)

      expect(error.name).to.equal("DependencyValidationError")
      expect(error.message).to.include("Dependency validation failed for test suite test-suite")
      expect(error.message).to.include("Component component-a references non-existent component non-existent")
      expect(error.message).to.include("Component component-b cannot depend on itself")
      expect(error.testSuiteName).to.equal("test-suite")
      expect(error.errors).to.deep.equal(errors)
    })
  })
})
