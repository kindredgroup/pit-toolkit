import express, { Request } from 'express'
import * as OpenApiValidator from 'express-openapi-validator';
import * as swaggerUi from 'swagger-ui-express';
import YAML from "yaml"
import fs from 'fs'
import path from 'path';
import { spawn } from 'child_process';
import Ajv from 'ajv';
import { pocRouter } from './routes.js';


const PORT = 3000

async function main() {

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // const oasFilePath = new URL('./open-api-spec.yaml', import.meta.url).pathname
  // try {
  //   await fs.promises.access(oasFilePath, fs.constants.R_OK)
  // } catch (e) {
  //   console.error(e)
  //   throw new Error(`There is no OAS schema file or it is not readable. File: "${oasFilePath}"`, { cause: e })
  // }
  // console.log("module path ...", path.resolve(__dirname))

  // const openSchemaYamlFile = fs.readFileSync("./schemas/report.yaml", 'utf8')
  // const parsedReportYaml = YAML.parse(openSchemaYamlFile)
  // console.dir(parsedReportYaml, { depth: 20 })

  const openApiYamlFile = fs.readFileSync("./open-api-spec.yaml", 'utf8')
  const parsedYaml = YAML.parse(openApiYamlFile)

  // const source = "./open-api-spec.yaml"; // or filename
  // resolver.resolve(parsedYaml, source, { resolve: true, resolveInternal: true })
  //   .then(function (options) {
  //     console.log("Resolved......!!!! ", options)
  //     fs.writeFileSync("./open-api-spec-output.yaml", YAML.stringify(options.openapi), 'utf8');
  //   })
  //   .catch(function (ex) {
  //     // ...
  //     console.error("Error in resolving... ", ex)
  //   });


  // const openApiYamlFileOutput = fs.readFileSync("./open-api-spec-output.yaml", 'utf8')
  // const parsedYamlOutput = YAML.parse(openApiYamlFileOutput)



  // console.dir(parsedYaml, { depth: 20 })
  // const fi = await $RefParser.dereference(parsedYaml, {
  //   // continueOnError: true,            // Don't throw on the first error
  //   parse: {
  //     json: { canParse: false }, // Disable the JSON parser
  //     yaml: {
  //       canParse: true
  //     },
  //     // text: {
  //     //   canParse: [".txt", ".html"],  // Parse .txt and .html files as plain text (strings)
  //     //   encoding: 'utf8'             // Use UTF-16 encoding
  //     // }
  //   },
  //   resolve: {
  //     external: true,
  //     file: true, // Don't resolve local file references
  //     // http: {
  //     //   timeout: 2000, // 2 second timeout
  //     //   withCredentials: true, // Include auth credentials when resolving HTTP references
  //     // }
  //   },
  //   dereference: {
  //     circular: true, // Don't allow circular $refs
  //     // excludedPathMatcher: (path: string | string[]) => // Skip dereferencing content under any 'example' key
  //     //   path.includes("/example/"),
  //     onDereference: (path: any, value: any) => // Callback invoked during dereferencing
  //       console.log(path, value)
  //   }
  // })
  // console.dir(fi, { depth: 20 })



  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(parsedYaml));

  app.use('/poc', pocRouter)
  // app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiSpec));
  // app.use(
  //   OpenApiValidator.middleware({
  //     apiSpec,
  //     validateRequests: true,
  //     validateResponses: true,
  //   }),
  // );
  // app.get('/test', (req, res) => {
  //   const metric: Metric = {
  //     type: EnumMetricType.SCALAR,
  //     value: 10

  //   }
  //   res.json({
  //     message: 'Hellooooooo!!!',
  //     metric
  //   });
  // })


  // app.post('/test', (req: Request<{}, {}, Metric>, res) => {

  //   const metric = req.body
  //   res.json({
  //     message: `Hellooooooo!!! ${JSON.stringify(metric)}`,
  //     code: 200
  //   });
  // })
  // app.post('/test-ajv', (req: Request<{}, {}, ScalarMetric>, res) => {

  //   const data = req.body
  //   const ajv = new Ajv.default()

  //   const validatePayload = ajv.compile(parsedReportYaml?.components?.schemas?.ScalarMetric)

  //   const isValid = validatePayload(data)
  //   console.log("Did validation pass....? ", isValid)

  //   if (!isValid) {
  //     console.error("Validation Error ", validatePayload.errors)
  //     res.json({
  //       code: 400,
  //       error: validatePayload.errors
  //     })
  //   } else {
  //     res.json({
  //       message: `Hellooooooo!!! ${JSON.stringify(data)}`,
  //       code: 200
  //     });
  //   }

  // })



  // app.use((err: { status: any; message: any; errors: any; }, req: any, res: { status: (arg0: any) => { (): any; new(): any; json: { (arg0: { message: any; errors: any; }): void; new(): any; }; }; }, next: any) => {
  //   // format error
  //   res.status(err.status || 500).json({
  //     message: err.message,
  //     errors: err.errors,
  //   });
  // });

  app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
  });


}



await main()