import * as Shell from "./shell-facade.js"
import { logger } from "./logger.js"
import { Namespace } from "./model.js"

const withLeadingZero = (value: number): string => {
  if (`${value}`.length == 2) return `${value}`
  return `0${value}`
}

export const generateNamespaceName = async (seqNumber: string, attempt?: number) => {
  const date = new Date()
  const attemptNr = attempt || 1
  const namespaceName = `ns${withLeadingZero(date.getMonth()+1)}${withLeadingZero(date.getDate())}-${seqNumber}-${attemptNr}`
  return namespaceName
}

export const createNamespace = async (rootNamespace: Namespace, namespace: Namespace, timeoutSeconds: number, workspace: string) => {
  const logFile = `${workspace}/create-ns-${namespace}.log`

  logger.info("Creating namespace: '%s'", namespace)
  const command = `k8s-deployer/scripts/k8s-manage-namespace.sh ${ rootNamespace } create "${ namespace }" ${ timeoutSeconds }`
  const timeoutMs = timeoutSeconds * 1_000
  await Shell.exec(command, { logFileName: logFile, tailTarget: logger.info, timeoutMs })

  logger.info("Namespace created: '%s'", namespace)
}

export const deleteNamespace = async (rootNamespace: Namespace, namespace: Namespace, timeoutSeconds: number, workspace: string) => {
  const logFile = `${workspace}/delete-ns-${namespace}.log`

  logger.info("Deleting namespace: '%s'", namespace)
  const timeoutMs = timeoutSeconds * 1_000
  const command = `k8s-deployer/scripts/k8s-manage-namespace.sh ${ rootNamespace } delete "${ namespace }" ${ timeoutSeconds }`
  await Shell.exec(command, { logFileName: logFile, tailTarget: logger.info, timeoutMs })
}