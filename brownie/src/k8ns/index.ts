import * as Shell from "node:child_process"

import { logger } from "../logger.js"
import * as Core from "./core.js"

const main = async () => {
  const params = new Map<string, string>()

  let deletedCount = 0
  for (let i = 2; i < process.argv.length; i+=2) {
    params.set(process.argv[i], process.argv[i + 1])
  }
  const config = Core.loadConfig(params)
  if (config.nsList.length == 0) {
    logger.debug("There are no namespaces to delete")
    return
  }

  logger.info("Analysing the list of %s namespaces", config.nsList.length)

  for (let ns of config.nsList) {
    logger.info("")

    if (!ns.metadata.creationTimestamp) {
      logger.info("Namespace '%s' does not have 'creationTimestamp' information. Skipping...", ns.metadata.name)
      continue
    }

    const nsName = ns.metadata.name
    const ageInMinutes = (new Date().getTime() - Date.parse(ns.metadata.creationTimestamp)) / 60_000
    logger.info("Namespace '%s' was created at: %s. It is %s minutes old", nsName, ns.metadata.creationTimestamp, ageInMinutes.toFixed(2))
    if (ageInMinutes < config.retentionMinutes) {
      logger.info("Namespace '%s' hasn't aged enough. Will be cleaned after %s minutes", nsName, (config.retentionMinutes - ageInMinutes).toFixed(2))
      continue
    }

    const parentNsName = ns.metadata.annotations[Core.HNC_PARENT_ANNOTATION]
    if (!parentNsName) {
      logger.warn("The child namespace '%s', does not have '%s' annotation. It might be misconfigured, hence need to be dealt with manually. Skipping...", nsName, Core.HNC_PARENT_ANNOTATION)
      continue
    }

    logger.info("Deleting namespace '%s' under '%s'", nsName, parentNsName)
    if (config.dryRun) {

      logger.info("Namespace '%s > %s' has NOT been deleted (dry run mode).", parentNsName, nsName)
      deletedCount++

    } else {

      try {

        const script = "../k8s-deployer/scripts/k8s-manage-namespace.sh"
        const scriptParams = [ parentNsName, "delete", nsName, 120 ]
        Shell.spawnSync(script, scriptParams, { stdio: [ 'inherit', 'inherit', 'inherit' ] })
        deletedCount++

      } catch (e) {
        logger.error("Unable to delete namespace %s > %s. Error: %s", parentNsName, nsName, e.message)
        if (e.cause) logger.error(e.cause)
        if (e.stack) logger.error("Stack:\n%s", e.stack)
      }
    }
  }
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })