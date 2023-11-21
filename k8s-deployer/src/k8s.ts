import * as Shell2 from "./shell-facade.js"
import { logger } from "./logger.js"
import { Namespace } from "./model.js"

const withLeadingZero = (value: number): string => {
  if (`${value}`.length == 2) return `${value}`
  return `0${value}`
}

const generateNamespaceName = async (seqNumber: string, attempt?: number) => {
  const date = new Date()
  const attemptNr = attempt || 1
  const namespaceName = `ns${withLeadingZero(date.getMonth()+1)}${withLeadingZero(date.getDate())}-${seqNumber}-${attemptNr}`
  return namespaceName
}

const createNamespace = async (namespace: Namespace, timeoutSeconds: number, workspace: string) => {
  const logFile = `${workspace}/create-ns-${namespace}.log`

  logger.info("Creating namespace for test suite: '%s'", namespace)
  const command = `k8s-deployer/scripts/k8s-manage-namespace.sh dev create "${namespace}" ${timeoutSeconds}`
  const timeoutMs = timeoutSeconds * 1_000
  await Shell2.exec(command, { logFileName: logFile, tailTarget: logger.info, timeoutMs })

  logger.info("Namespace created: '%s'", namespace)
}

export {
  generateNamespaceName,
  createNamespace
}