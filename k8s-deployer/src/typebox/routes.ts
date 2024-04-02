import express, { Request } from "express";
import Ajv from "ajv";
import fs from 'fs'
import YAML from "yaml"
import { ScalarMetric } from "../test-app-client/report/schema-v1.js";
import { getPitSchema } from "../schema-validations.js";

const router = express.Router()

// const openApiYamlFile = fs.readFileSync("./open-api-spec.yaml", 'utf8')

router.post('/test-ajv', (req: Request<{}, {}, ScalarMetric>, res) => {
  const parsedYaml = getPitSchema()

  const data = req.body
  const ajv = new Ajv.default()

  const validatePayload = ajv.compile(parsedYaml?.components?.schemas?.ScalarMetric)

  const isValid = validatePayload(data)
  console.log("Did validation pass....? ", isValid)

  if (!isValid) {
    console.error("Validation Error ", validatePayload.errors)
    res.json({
      code: 400,
      error: validatePayload.errors
    })
  } else {
    res.json({
      message: `Hellooooooo!!! ${JSON.stringify(data)}`,
      code: 200
    });
  }

})

export const pocRouter = router



