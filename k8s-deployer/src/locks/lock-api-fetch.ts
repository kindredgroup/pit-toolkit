import { logger } from "../logger.js";
import fetch from "node-fetch"

export type ApiOptions = {
    endpoint: string,
    options: Object
}
export type RetryOptions={
    retries: number,
    retryDelay: number
    api: ApiOptions,
}

const retryFetch = async (retryAPIOptions:RetryOptions, apiBody:Object) =>{ 

    let {retries, retryDelay, api} = retryAPIOptions
    let attempts = 0
    while (retries > 0) {
        logger.info("retryFetch(): fetching %s", api)
        try{
            logger.info("retryFetch(): fetching %s", attempts)
            let resp  = await apiFetch(api, apiBody)
            logger.info("retryFetch(): returning resp %s", resp)
            return resp
        }catch(error){
            logger.warn("retryFetch(): retrying fetch %s because of %s", attempts, error)
            if (attempts < retries) {
                attempts++
                await retryWait(retryDelay)
                continue
            }else{
                logger.warn("retryFetch(): failed to fetch %s", attempts)
                throw new Error(`Failed to fetch ${api.endpoint} after ${attempts} retries`)
            }
        }
    }
    
}


const apiFetch = async (api:{endpoint:string, options}, apiBody:Object) =>{
    logger.info("apiFetch(): fetching %s", api)
    let resp = await fetch(api.endpoint,
      {...api.options, body: JSON.stringify(apiBody) }
      )
      let respJson = await resp.json()
      
      logger.info("apiFetch(): for %s with body %s and resp %s", api, JSON.stringify(apiBody), respJson)
      return respJson
  }

  const retryWait = (time) =>  new Promise(resolve => setTimeout(resolve, time))

  export {retryFetch}

