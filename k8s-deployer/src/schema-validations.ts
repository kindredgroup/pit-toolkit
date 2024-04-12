import Ajv from 'ajv'
import fs from 'fs'
import YAML from "yaml"

function parseApiSchemaYaml(path: string) {
  const openApiYamlFile = fs.readFileSync(path, 'utf8')
  const parsedYaml = YAML.parse(openApiYamlFile)

  return parsedYaml
}

export enum ApiValidationTypes {
  RequestQueryParams = "RequestQueryParams",
  RequestPathParams = "RequestPathParams",
  RequestBody = "RequestBody",
  Response = "Response"
}

export interface ApiValidators {
  schemaPath: {
    [K in ApiValidationTypes]?: string
  }
  schemaValidator: Ajv.default
}

const SCHEMA_NAME = "apiSpec"

export const getSchemaRef = (schema: string) => {
  return `${SCHEMA_NAME}#${schema}`
}

export const setupSchemaValidator = (path = new URL("./open-api-spec-v1.yaml", import.meta.url).pathname) => {
  const parsedSchema = parseApiSchemaYaml(path)

  const schemaValidator = new Ajv.default({ strict: false })
  schemaValidator.addSchema(parsedSchema, SCHEMA_NAME)

  return schemaValidator
}