import * as Shell2 from "./shell-facade.js"
import { logger } from "./logger.js"
// import * as TailLog from "./tail-log.js"

const withLeadingZero = (value: number): string => {
  if (`${value}`.length == 2) return `${value}`
  return `0${value}`
}

const generateNamespaceName = async (seqNumber: string, attempt?: number) => {
  const date = new Date()
  const attemptNr = attempt || 1
  const namespace = `ns${withLeadingZero(date.getMonth()+1)}${withLeadingZero(date.getDay())}-${seqNumber}-${attemptNr}`
  return namespace
}

const createNamespace = async (namespace: string, timeoutSeconds: number, workspace: string) => {
  const logFile = `${workspace}/create-ns-${namespace}.log`
  const startedAt = new Date()
  logger.info("Creating namespace for test suite: '%s'", namespace)
  const command = `k8s-deployer/scripts/k8s-manage-namespace.sh dev create "${namespace}" ${timeoutSeconds}`
  const timeoutMs = timeoutSeconds * 1_000
  await Shell2.exec(command, { logFileName: logFile, tailTarget: logger.info, timeoutMs })
  // Shell2.exec(`k8s-deployer/scripts/k8s-manage-namespace.sh dev create "${namespace}" ${timeoutSeconds} "${TailLog.STATUS_DONE}" "${TailLog.STATUS_ERROR}" > ${logFile} 2>&1`)
  // await TailLog.monitorProgress(logFile, startedAt.getTime(), timeoutSeconds * 1_000)

  logger.info("Namespace created: '%s'", namespace)
}

export {
  generateNamespaceName,
  createNamespace
}