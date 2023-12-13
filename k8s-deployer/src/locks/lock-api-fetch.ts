import { logger } from "../logger.js";
import fetch from "node-fetch"

let attempts = 0

export type ApiOptions = {
    endpoint: string,
    options: Object
}
export type RetryOptions={
    retries: number,
    retryDelay: number
    api: ApiOptions
}

const retryFetch = async (retryAPIOtpions:RetryOptions, apiBody:Object) =>{ 

    let {retryOptions, retryDelay, api } = retryAPIOtpions as any
    attempts++
    try{
        let resp  = await apiFetch(api, apiBody)
        return resp
    }catch(error){
        logger.warn("retryFetch(): retrying fetch %s", attempts)
        if (attempts <= retryOptions.retries) {
            await wait(retryDelay)
            return retryFetch(retryAPIOtpions, apiBody)
        }else{
            logger.warn("retryFetch(): failed to fetch %s", attempts)
            throw new Error(`Failed to fetch ${api.enpoint} after ${attempts} retries`)
        }
    }
}


const apiFetch = async (api:{endpoint:string, options}, apiBody:Object) =>{
    
    let resp = await fetch(api.endpoint,
      {...api.options, body: JSON.stringify(apiBody) }
      )
      let respJson = await resp.json()
      
      logger.info("apiFetch(): for %s with body %s and resp %s", api, JSON.stringify(apiBody), respJson)
      return respJson
  }

  const wait = (time = 0) => {
    return new Promise(() => {
      setTimeout(() => { }, time * 1000);
    });
  };

  export {apiFetch,retryFetch}

