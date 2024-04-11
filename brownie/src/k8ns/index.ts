import * as fs from "fs"
import * as Shell from "node:child_process"

import { logger } from "../logger.js"
import { Config } from "../config.js"

const main = async () => {
  const nsDataFile = process.argv[2]
  const retentionRaw = process.argv[3]

  // validate ...

  const nsListRaw = fs.readFileSync(`${ nsDataFile }`).toString("utf-8")
  let nsList = null
  try {
    nsList = JSON.parse(nsListRaw)
  } catch (e) {
    logger.warn("\n%s", nsListRaw)
    throw new Error(`Unable to parse raw list of namespaces in '${ nsDataFile }'`, { cause: e })
  }

  logger.info("\n%s", JSON.stringify(nsList, null, 2))

  const retentionMinutes = Config.parseRetention(retentionRaw)
  for (let ns of nsList) {
    if (!ns.metadata.creationTimestamp) {
      logger.info("Namespace '%s' does not have 'creationTimestamp' information. Skipping...", ns.metadata.name)
      continue
    }

    const nsName = ns.metadata.name
    const ageInMinutes = (new Date().getTime() - Date.parse(ns.metadata.creationTimestamp)) / 60_000
    logger.info("Namespace '%s' was created at: %s. It is %s minutes old", nsName, ns.metadata.creationTimestamp, ageInMinutes)
    if (ageInMinutes < retentionMinutes) {
      logger.info("Namespace '%s' hasn't aged enough. Will be cleaned after %s minutes", nsName, (retentionMinutes - ageInMinutes))
      continue
    }

    const parentNsName = ns.metadata.annotations["hnc.x-k8s.io/subnamespace-of"]
    if (!parentNsName) {
      logger.warn("The child namespace '%s', does not have 'hnc.x-k8s.io/subnamespace-of' annotation. It might be misconfigured, hence need to be dealt with manually. Skipping...")
      continue
    }


    logger.info("Cleaning namespace '%s' under '%s'", nsName, parentNsName)

    const logFile = `./clean-ns-${nsName}.log`
    const out = fs.openSync(logFile, 'a')
    const err = fs.openSync(logFile, 'a')

    const fnCleanLogData = (data: any): string => {
      if (!data) return
      let text = data.toString()
      if (text.trim().length == 0) return
      if (text.endsWith("\n")) text = text.substring(0, text.length-1)
      return text
    }
    let tailer = null
    setTimeout(() => {
      tailer = Shell.spawn("tail", [ "-f", logFile ], { detached: true })
      tailer.stdout.on('data', function(data){
        const text = fnCleanLogData(data)
        if (text) logger.info(text)
      })
      tailer.stderr.on('data', function(data){
        const text = fnCleanLogData(data)
        if (text) logger.error(text)
      })
    }, 0)
    // setTimeout(() => {
    const process = Shell.spawnSync(
      "../k8s-deployer/scripts/k8s-manage-namespace.sh",
      [ parentNsName, "delete", nsName, 120 ],
      {
        stdio: [ 'ignore', out, err ]
      }
    )

    if (tailer) tailer.kill()
  }
}

main()
  .catch(e => {
    logger.error("Message: %s", e.message)
    if (e.cause) logger.error(e.cause)
    if (e.stack) logger.error("Stack:\n%s", e.stack)
  })