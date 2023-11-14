import * as fs from "fs"
import YAML from "yaml"

import { logger } from "../logger.js"
import * as SchemaV1 from "./schema-v1.js"

const DEFAULT_GIT_REFERENCE = "refs/remotes/origin/master"

/**
 * The pattern for environment variable injection is "{{ env.VARIABLE_NAME }}"
 * @param expression containing injection pattern.
 * @returns expression with substituted value instead of env variable.
 */
const applyEnvironment = (expression: string): string => {
  let foundVariables = []
  let iteration = 0
  let expressionToParse = expression
  while (true) {
      iteration++
      if (iteration > 100) break

      const pattern = /.*(\$\{\{.*env\..*\}\}).*/g
      let result = pattern.exec(expressionToParse)
      if (!(result?.length > 1)) {
          break
      }
      const token = result[1]
      foundVariables.push(token.replaceAll(/env\.|[ {}$]/g, ""))
      expressionToParse = expressionToParse.replace(token, "")
  }

  let processedExpression = expression.replaceAll(/\{ |[ {}$]/g, "")
  for (let variable of foundVariables) {
      const value = process.env[variable]
      let replacement = variable
      if (value) {
          replacement = value
      } else {
          logger.warn("Cannot replace variable \"%s\". There is no env varaible with this name.", variable)
      }
      processedExpression = processedExpression.replaceAll(`env.${variable}`, replacement)
  }

  return processedExpression
}

const applyEnvironmentToLocation = (location: SchemaV1.Location): SchemaV1.Location => {
  if (!location.gitRef && !location.gitRepository) return location
  const result = { ...location }

  if (result.gitRef) result.gitRef = applyEnvironment(result.gitRef)
  if (result.gitRepository) result.gitRepository = applyEnvironment(result.gitRepository)
  return result
}

const applyDefaultsToLocation = (name: string, input: SchemaV1.Location): SchemaV1.Location => {
  let location = !input ? new SchemaV1.Location() : {...input}

  if (!location.type) {
    location.type = SchemaV1.LocationType.Local
  } else if (location.type === SchemaV1.LocationType.Remote) {
    if (!location.gitRepository) {
      throw new Error(`Invalid configiuration for '${name}'. The 'location.gitRepository' is required when location.type is ${SchemaV1.LocationType.Remote}`)
    }
    if (!location.gitRef) {
      location.gitRef = DEFAULT_GIT_REFERENCE
    }
  }

  return applyEnvironmentToLocation(location)
}

const applyDefaults = (file: SchemaV1.PitFile): SchemaV1.PitFile => {
  const result = {...file}
  for (const testSuite of result.testSuites) {
    testSuite.location = applyDefaultsToLocation(testSuite.id, testSuite.location)

    const testApp = testSuite.deployment.graph.testApp
    testApp.location = applyDefaultsToLocation(`${testSuite.id}.deployment.graph."${testApp.id}"`, testApp.location)

    for (const component of testSuite.deployment.graph.components) {
      component.location = applyDefaultsToLocation(`${testSuite.id}.deployment.graph.components."${component.id}"`, component.location)
    }
  }

  return result
}

const loadFromFile = async (filePath: string): Promise<SchemaV1.PitFile> => {
  try {
      await fs.promises.access(filePath, fs.constants.R_OK)
  } catch (e) {
      throw new Error(
          `There is no pitfile or it is not readable. File: "${ filePath }"`,
          { cause: e }
      )
  }

  const parsedPitFile: SchemaV1.PitFile = YAML.parse(fs.readFileSync(filePath, "utf8"))
  logger.info("parsedPitFile: \n%s", JSON.stringify(parsedPitFile, null, 2))

  return applyDefaults(parsedPitFile)
}

export { loadFromFile }