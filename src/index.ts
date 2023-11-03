import * as fs from "fs"
import * as Shell from "child_process"
import YAML from "yaml"

import { logger } from "./logger"

const DEFAULT_PITFILE_NAME = "pitfile.yml"
const PARAM_WORKSPACE = "--workspace"
const PARAM_PITFILE = "--pitfile"

function applyEnvironment(expression: string): string {
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

function readParams(): Map<string, string> {
    logger.info("Application started with arguments: ")
    const rawParams = process.argv.slice(2)
    if (rawParams.length %2 !== 0) {
        throw "Invalid parameters format. Expected format is: \"--parameter-name parameter-value\""
    }
    const params = new Map<string, string>()
    for (let i = 0; i < rawParams.length; i += 2) {
        params.set(rawParams[i], rawParams[i + 1])
    }

    logger.debug(JSON.stringify({ "params-length": params.size, "params-content": Object.fromEntries(params) }, null, 2))

    const workspace = params.get(PARAM_WORKSPACE)
    if (!(workspace?.trim().length > 0)) {
        throw `Missing required parameter: "${ PARAM_WORKSPACE }"`
    }

    return params
}

async function validateWorkspace(workspace: string) {
    try {
        logger.info("Valdiating workspace directory: \"%s\"", workspace)
        await fs.promises.access(workspace, fs.constants.W_OK)
        logger.info("Workspace is: OK")
    } catch (e) {
        throw new Error(
            `It looks like the workspace directory is not writable. Workspace: ${ workspace }`,
            { cause: e }
        )
    }
}

async function readPitFile(params: Map<string, string>): Promise<any> {
    let pitFile = `./${ DEFAULT_PITFILE_NAME }`
    if (params.has(PARAM_PITFILE)) {
        pitFile = params.get(PARAM_PITFILE)
    }

    try {
        await fs.promises.access(pitFile, fs.constants.R_OK)
    } catch (e) {
        throw new Error(
            `There is no pitfile or it is not readable. File: "${ pitFile }"`,
            { cause: e }
        )
    }

    const parsedPitFile = YAML.parse(fs.readFileSync(pitFile, "utf8")) as any
    parsedPitFile.deployment.sitrus.gitRef = applyEnvironment(parsedPitFile.deployment.sitrus.gitRef)

    return parsedPitFile
}

async function main() {
    const params = readParams()

    const workspace = params.get(PARAM_WORKSPACE)
    await validateWorkspace(workspace)

    const pitFile = await readPitFile(params)

    const sitrus = pitFile.deployment.sitrus
    
    logger.info("Clonning copy of Sitrus from %s", sitrus.gitRepository)
    const result = Shell.execSync(`../scripts/git-co.sh ${ sitrus.gitRepository } ${ sitrus.gitRef } ${ workspace }/sitrus`, { env: process.env } )
    logger.info("\n%s", result)
}

(async () => await main())()