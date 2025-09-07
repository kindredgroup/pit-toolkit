export class CyclicDependencyError extends Error {
  public readonly cyclePath: Array<string>
  public readonly componentId: string

  constructor(cyclePath: Array<string>, componentId: string) {
    const cycleString = cyclePath.join(' → ')
    super(`Cyclic dependency detected: ${cycleString} → ${componentId}`)
    this.name = "CyclicDependencyError"
    this.cyclePath = cyclePath
    this.componentId = componentId
  }
}

export class InvalidDependencyError extends Error {
  public readonly componentId: string
  public readonly invalidDependency: string

  constructor(componentId: string, invalidDependency: string) {
    super(`Component ${componentId} references non-existent component ${invalidDependency}`)
    this.name = "InvalidDependencyError"
    this.componentId = componentId
    this.invalidDependency = invalidDependency
  }
}

export class SelfDependencyError extends Error {
  public readonly componentId: string

  constructor(componentId: string) {
    super(`Component ${componentId} cannot depend on itself`)
    this.name = "SelfDependencyError"
    this.componentId = componentId
  }
}

export class DuplicateComponentIdError extends Error {
  public readonly componentId: string

  constructor(componentId: string) {
    super(`Duplicate component ID ${componentId} found`)
    this.name = "DuplicateComponentIdError"
    this.componentId = componentId
  }
}

export class DependencyValidationError extends Error {
  public readonly errors: Array<Error>
  public readonly testSuiteName: string

  constructor(testSuiteName: string, errors: Array<Error>) {
    const errorMessages = errors.map(e => e.message).join('; ')
    super(`Dependency validation failed for test suite ${testSuiteName}: ${errorMessages}`)
    this.name = "DependencyValidationError"
    this.errors = errors
    this.testSuiteName = testSuiteName
  }
}

export class ApiSchemaValidationError extends Error {
  public readonly validationErrors: string
  public readonly endpoint: string
  public readonly response: string
  public readonly url: string
  public readonly data?: string

  constructor(validationErrors: string, endpoint: string, response: string) {
    super(`API schema validation failed for endpoint ${endpoint}: ${validationErrors}`)
    this.name = "ApiSchemaValidationError"
    this.validationErrors = validationErrors
    this.endpoint = endpoint
    this.response = response
    this.url = endpoint
    this.data = response
  }
}