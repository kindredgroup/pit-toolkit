import fetch, { RequestInit, Response } from "node-fetch"

import { logger } from "../logger.js"

export type FetchParams = {
  endpoint: string,
  options: RequestInit
}

export type RetryOptions = {
  retries: number,
  retryDelay: number,
  fetchParams: FetchParams
}

export class HttpErrorOptions {
  cause?: Error
  responseData?: string | unknown
}

export class HttpError extends Error {
  readonly type: string = "HttpError"
  responseData?: string | unknown
  constructor(
    readonly method: string,
    readonly endpoint: string,
    readonly status: number,
    readonly text: string,
    private options: HttpErrorOptions
  ){
    super(text, { cause: options.cause })
    this.responseData = options.responseData
  }

  toString(): string {
    return JSON.stringify({ method: this.method, endpoint: this.endpoint, status: this.status, text: this.text, responseData: this.responseData, cause: this.cause })
  }
}

export const invoke = async (options: RetryOptions, apiBody: Object) => {
  let attempts = 1
  while (options.retries > 0) {
    logger.info("http-client.invoke(): attempt %s of %s invoking %s", attempts, options.retries, JSON.stringify(options.fetchParams))
    try {
        return await invokeApi(options.fetchParams, apiBody)
    } catch (error: unknown) {
      logger.warn("http-client.invoke(): attempt %s of %s invoking %s. Error: %s", attempts, options.retries, JSON.stringify(options.fetchParams), error)
      if (attempts < options.retries) {
        attempts++
        await sleep(options.retryDelay)
        continue
      }

      logger.warn("http-client.invoke(): failed to invoke %s. No more attempts left, giving up", JSON.stringify(options.fetchParams))
      throw new Error(`Failed to fetch ${ options.fetchParams.endpoint } after ${ attempts } attempts`, { cause: error })
    }
  }
}

const invokeApi = async (params: FetchParams, apiBody: Object): Promise<unknown | string> => {
  const resp = await fetch(params.endpoint, { ...params.options, body: JSON.stringify(apiBody) })
  const readPayload = async (response: Response): Promise<unknown | string> => {
    const ctHeader = "content-type"
    const hdrs = response.headers
    if (hdrs.has(ctHeader) && `${ hdrs.get(ctHeader) }`.toLowerCase().startsWith("application/json")) {
      try {
        return await response.json()
      } catch (e) {
        logger.warn("Unable to parse JSON when handling response from '%s', handling will fallback to reading the payload as text. Parsing error: %s", params.endpoint, e)
        return await response.text()
      }
    } else {
      return await response.text()
    }
  }

  if (resp.ok) {
    logger.info("invokeApi(): resp was ok, reading payload")
    return await readPayload(resp)
  } else {
    logger.info("invokeApi(): resp was not ok, raising error")
    throw new HttpError(
      params.options.method,
      params.endpoint,
      resp.status,
      resp.statusText,
      { responseData: await readPayload(resp) })
  }
}

export const sleep = (time: number) => new Promise(resolve => setTimeout(resolve, time))
