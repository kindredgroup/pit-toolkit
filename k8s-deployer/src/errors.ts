export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(`SchemaValidationError: ${message}`);
  }
}

export class ApiSchemaValidationError extends SchemaValidationError {
  data?: string
  url: string
  constructor(message: string, url: string, data?: any) {
    super(message);
    this.url = url
    this.data = data
  }
}