import fetch from "node-fetch"

import { logger } from "../logger.js"

export type FetchParams = {
    endpoint: string,
    options: Object
}

export type RetryOptions = {
    retries: number,
    retryDelay: number,
    fetchParams: FetchParams
}

export const invoke = async (options: RetryOptions, apiBody: Object) => {
    let attempts = 1
    while (options.retries > 0) {
        logger.info("lock-manager-api-client.invoke(): attempt %s of %s invoking %s", attempts, options.retries, JSON.stringify(options.fetchParams))
        try {
            return await invokeApi(options.fetchParams, apiBody)
        } catch (error) {
            logger.warn("lock-manager-api-client.invoke(): attempt %s of %s invoking %s. Error: %s", attempts, options.retries, JSON.stringify(options.fetchParams), error)
            if (attempts < options.retries) {
                attempts++
                await sleep(options.retryDelay)
                continue
            }

            logger.warn("lock-manager-api-client.invoke(): failed to invoke %s. No more attempts left, giving up", JSON.stringify(options.fetchParams))
            throw new Error(`Failed to fetch ${ options.fetchParams.endpoint } after ${ attempts } attempts`, { cause: error })
        }
    }
}

const invokeApi = async (params: FetchParams, apiBody: Object) =>{
    let resp = await fetch(params.endpoint, { ...params.options, body: JSON.stringify(apiBody) })
    // TODO: check for JSON header before decoding
    return await resp.json()
}

export const sleep = (time: number) =>  new Promise(resolve => setTimeout(resolve, time))
