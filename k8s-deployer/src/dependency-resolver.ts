import { Schema } from "./model.js"
import {
  CyclicDependencyError,
  InvalidDependencyError,
  SelfDependencyError,
  DuplicateComponentIdError,
  DependencyValidationError
} from "./errors.js"

export interface TopologicalSortResult {
  sortedComponents: Array<Schema.DeployableComponent>
  levels: Array<Array<Schema.DeployableComponent>>  // Components grouped by dependency level
}

/**
 * Validate all dependencies for a set of components and throws appropriate errors
 * Validation checks the following:
 * 1. Cyclic dependencies
 * 2. Self-dependencies
 * 3. Invalid references
 * 4. Duplicate component IDs
 */
export const validateDependencies = (
  components: Array<Schema.DeployableComponent>,
  testSuiteName: string
): void => {
  const errors: Array<Error> = []

  // Check for duplicate component IDs
  const componentIdCount = new Map<string, number>()
  components.forEach(({ id }) => {
    componentIdCount.set(id, (componentIdCount.get(id) ?? 0) + 1)
    if (componentIdCount.get(id) > 1) {
      errors.push(new DuplicateComponentIdError(id))
    }
  })

  // Check for invalid component ID references and self-dependencies
  components.forEach(component => {
    const { id, dependsOn } = component
    if (dependsOn) {
      dependsOn.forEach(depId => {
        if (depId === id) {
          errors.push(new SelfDependencyError(id))
        }
        if (!componentIdCount.has(depId)) {
          errors.push(new InvalidDependencyError(id, depId))
        }
      })
    }
  })

  // Check for cyclic dependencies
  const cyclicError = detectCyclicDependencies(components)
  if (cyclicError) {
    errors.push(cyclicError)
  }

  // Throw all errors found
  if (errors.length > 0) {
    throw new DependencyValidationError(testSuiteName, errors)
  }
}

/**
 * Detect cyclic dependencies using DFS
 */
export const detectCyclicDependencies = (components: Array<Schema.DeployableComponent>): CyclicDependencyError | undefined => {
  const unvisited = 0, visiting = 1, visited = 2
  const state = new Map<string, number>()
  const parent = new Map<string, string>()
  const componentMap = new Map<string, Schema.DeployableComponent>()

  // Initialize
  components.forEach(comp => {
    componentMap.set(comp.id, comp)
    state.set(comp.id, unvisited)
  })

  const dfs = (componentId: string): CyclicDependencyError | undefined => {
    if (state.get(componentId) === visited) {
      return undefined
    }

    // Found a cycle. Include the cycle path in the error
    if (state.get(componentId) === visiting) {
      return new CyclicDependencyError(reconstructCyclePath(componentId, parent), componentId)
    }

    state.set(componentId, visiting)

    const component = componentMap.get(componentId)
    if (!component) {
      return undefined
    }
    if (component.dependsOn) {
      for (const depId of component.dependsOn) {
        parent.set(depId, componentId)
        const result = dfs(depId)
        if (result) {
          return result
        }
      }
    }

    state.set(componentId, visited)
  }

  // Check all components
  for (const component of components) {
    if (state.get(component.id) === unvisited) {
      const result = dfs(component.id)
      if (result) {
        return result
      }
    }
  }
}

/**
 * Perform topological sort
 * Preserve original order for components at the same dependency level
 */
export const topologicalSort = (components: Array<Schema.DeployableComponent>): TopologicalSortResult => {
  // Build adjacency list and in-degree count
  const graph = new Map<string, string[]>()
  const inDegreeMap = new Map<string, number>()
  const componentMap = new Map<string, Schema.DeployableComponent>()

  // Initialize
  components.forEach(comp => {
    componentMap.set(comp.id, comp)
    graph.set(comp.id, [])
    inDegreeMap.set(comp.id, 0)
  })

  // Build graph and calculate in-degrees
  components.forEach(({ id, dependsOn }) =>
    dependsOn?.forEach(depId => {
      graph.get(depId)?.push(id)
      inDegreeMap.set(id, (inDegreeMap.get(id) ?? 0) + 1)
    })
  )

  // Find components with in-degree = 0
  const queue: string[] = []
  inDegreeMap.forEach((degree, id) => { if (degree === 0) queue.push(id) })

  // Sort components using BFS
  const result: Schema.DeployableComponent[] = []
  const levels: Schema.DeployableComponent[][] = []

  while (queue.length > 0) {
    const currentLevel: Schema.DeployableComponent[] = []
    const currentLevelSize = queue.length

    // Process all components at current level
    for (let i = 0; i < currentLevelSize; i++) {
      const currentId = queue.shift()!
      const component = componentMap.get(currentId)!
      currentLevel.push(component)

      // Update in-degrees of dependent components
      graph.get(currentId)?.forEach(depId => {
        const newDegree = (inDegreeMap.get(depId) ?? 0) - 1
        inDegreeMap.set(depId, newDegree)
        if (newDegree === 0) {
          queue.push(depId)
        }
      })
    }

    // Sort current level by original order defined in the pitfile
    // The deployment order on the same dependency level follows the component definition order
    currentLevel.sort((a, b) => {
      const aIndex = components.findIndex(c => c.id === a.id)
      const bIndex = components.findIndex(c => c.id === b.id)
      return aIndex - bIndex
    })

    // Add sorted components to result
    currentLevel.forEach(component => result.push(component))
    levels.push([...currentLevel])
  }

  return { sortedComponents: result, levels }
}

/**
 * Return components in reverse order for undeployment
 * Only reverse dependency levels but maintain original component definition order within each level
 * The undeployment order on the same dependency level follows the component definition order
 */
export const reverseTopologicalSort = (sortResult: TopologicalSortResult): Array<Schema.DeployableComponent> => [...sortResult.levels].reverse().flat()

/**
 * Traceback the dependency path when a cycle is detected
 * This is for troubleshooting convenience
 */
const reconstructCyclePath = (startId: string, parent: Map<string, string>): Array<string> => {
  const path: Array<string> = []
  let current = startId

  do {
    path.push(current)
    current = parent.get(current)!
  } while (current !== startId)

  return path
}
