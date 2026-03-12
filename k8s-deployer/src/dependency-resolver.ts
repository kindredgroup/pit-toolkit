import { Schema } from "./model.js"
import { mermaidToAscii } from "mermaid-ascii"
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

// Returns the mermaid node identifier for a component.
// Parallel components get a _🔀 suffix so the box label shows the flag.
const nodeId = (c: Schema.DeployableComponent): string =>
  c.deploy.parallel === true ? `${c.id}_🔀` : c.id

// Build a `graph TD` mermaid source string from the sorted levels + testApp.
const buildMermaidSrc = (
  levels: Array<Array<Schema.DeployableComponent>>,
  components: Array<Schema.DeployableComponent>,
  testApp: Schema.DeployableComponent
): string => {
  const componentMap = new Map(components.map(c => [c.id, c]))
  const edgeLines: string[] = []

  // Edges from dependsOn relationships
  components.forEach(c => {
    (c.dependsOn ?? []).forEach(depId => {
      const dep = componentMap.get(depId)!
      edgeLines.push(`  ${nodeId(dep)} --> ${nodeId(c)}`)
    })
  })

  // Sequential testApp: connect every last-level component to the testApp node
  if (testApp.deploy.parallel !== true && levels.length > 0) {
    levels[levels.length - 1].forEach(c => {
      edgeLines.push(`  ${nodeId(c)} --> ${testApp.id}`)
    })
  }

  // Nodes that appear in no edge must be declared explicitly or they won't render
  const edgeText = edgeLines.join("\n")
  const allNodes = [
    ...components,
    ...(testApp.deploy.parallel !== true ? [testApp] : [])
  ]
  const isolatedDeclarations = allNodes
    .filter(c => !edgeText.includes(nodeId(c)))
    .map(c => `  ${nodeId(c)}`)

  return ["graph TD", ...isolatedDeclarations, ...edgeLines].join("\n")
}

// Format a single dependency level into a display string.
// Parallel components are grouped in brackets; sequential follow after an arrow.
// e.g. "[B 🔀  C 🔀] → D  E" or "[B 🔀] → C" or "A  B" (all sequential)
const formatLevel = (level: Array<Schema.DeployableComponent>): string => {
  const parallel = level.filter(c => c.deploy.parallel === true)
  const sequential = level.filter(c => c.deploy.parallel !== true)
  const parallelPart = parallel.length > 0 ? `[${parallel.map(c => `${c.id} 🔀`).join("  ")}]` : ""
  const sequentialPart = sequential.map(c => c.id).join("  ")
  if (parallelPart && sequentialPart) return `${parallelPart} → ${sequentialPart}`
  return parallelPart || sequentialPart
}

/**
 * Print the full deployment graph including testApp placement.
 *
 * Outputs two representations:
 * 1. Stage list — "Stage N │ [parallel 🔀] → sequential" text summary
 * 2. ASCII art diagram via mermaid-ascii (parallel components labelled with _🔀)
 *
 * If testApp.deploy.parallel === true it is shown in a concurrent banner rather
 * than as a stage/diagram node.
 */
export const printDependencyGraph = (graph: Schema.Graph): void => {
  const { components, testApp } = graph
  const { levels } = topologicalSort(components)
  const sep = "─".repeat(40)

  console.log("Dependency Graph")
  console.log(sep)

  // ── Stage list ────────────────────────────────────────────────────────────
  if (testApp.deploy.parallel === true) {
    levels.forEach((level, idx) =>
      console.log(`  Stage ${idx + 1} │  ${formatLevel(level)}`)
    )
    console.log(sep)
    console.log(`  ${testApp.id} 🔀  (concurrent with component stages)`)
  } else {
    levels.forEach((level, idx) =>
      console.log(`  Stage ${idx + 1} │  ${formatLevel(level)}`)
    )
    console.log(`  Stage ${levels.length + 1} │  ${testApp.id}`)
  }

  // ── ASCII art diagram ─────────────────────────────────────────────────────
  console.log(sep)
  const mermaidSrc = buildMermaidSrc(levels, components, testApp)
  const originalDebug = console.debug
  console.debug = () => {}
  const asciiArt = mermaidToAscii(mermaidSrc)
  console.debug = originalDebug
  asciiArt.split("\n").forEach(line => console.log(line))

  console.log(sep)
}
