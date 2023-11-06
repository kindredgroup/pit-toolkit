import * as fs from "fs"
import YAML from "yaml"
import { logger } from "./logger"

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

const readPitFile = async (filePath: string): Promise<any> => {
  try {
      await fs.promises.access(filePath, fs.constants.R_OK)
  } catch (e) {
      throw new Error(
          `There is no pitfile or it is not readable. File: "${ filePath }"`,
          { cause: e }
      )
  }

  const parsedPitFile = YAML.parse(fs.readFileSync(filePath, "utf8")) as any
  parsedPitFile.lockManager.location.gitRef = applyEnvironment(parsedPitFile.lockManager.location.gitRef)

  return parsedPitFile
}

export { readPitFile }