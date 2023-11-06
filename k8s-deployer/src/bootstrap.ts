import { Config } from "./config"
import { logger } from "./logger"

const PARAM_WORKSPACE = "--workspace"
const PARAM_PITFILE = "--pitfile"

const readParams = (): Config => {
  logger.debug("readParams()... \n%s", JSON.stringify(process.argv, null, 2))

  const rawParams = process.argv.slice(2)
  if (rawParams.length %2 !== 0) {
      throw new Error("Invalid parameters format. Expected format is: \"--parameter-name parameter-value\"")
  }
  const params = new Map<string, string>()
  for (let i = 0; i < rawParams.length; i += 2) {
      params.set(rawParams[i], rawParams[i + 1])
  }

  logger.debug("Application started with arguments: \n%s", JSON.stringify(Object.fromEntries(params), null, 2))

  const workspace = params.get(PARAM_WORKSPACE)
  if (!(workspace?.trim().length > 0)) {
      throw new Error(`Missing required parameter: "${ PARAM_WORKSPACE }"`)
  }

  return { workspace, pitfile: params.get(PARAM_PITFILE), params }
}

export {
  readParams
}