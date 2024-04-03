import Ajv from 'ajv'
import fs from 'fs'
import YAML from "yaml"

function parsePitYamlSchemaToJs(path: string) {
  const openApiYamlFile = fs.readFileSync(path, 'utf8')
  const parsedYaml = YAML.parse(openApiYamlFile)

  return () => parsedYaml
}

console.log('Current directory: ' + process.cwd());

export const getPitSchema = parsePitYamlSchemaToJs("./k8s-deployer/open-api-spec.yaml")

// const getSchemaPath = (schemaPath) => {

// }

// export const validateReportPayload = () => {


// }

export enum ApiSchemaValidatorVariants {
  startRequest = "startRequest",
  startResponse = "startResponse",
  statusRequestQueryParams = "statusRequestQueryParams",
  statusResponse = "statusResponse",
  reportRequestQueryParams = "reportRequestQueryParams",
  reportResponse = "reportResponse"

}

export const schemaValidator = new Ajv.default({strict: false})

const SCHEMA_NAME = "apiSpec"

export const getSchemaRef = (schema: string) => {
  // return { "$ref": `${SCHEMA_NAME}#/components/schemas/${schema}`}
  return `${SCHEMA_NAME}#/components/schemas/${schema}`
}

export const setupSchemaValidators = () => {
  const parsedSchema = getPitSchema()
  schemaValidator.addSchema(parsedSchema, SCHEMA_NAME)
}