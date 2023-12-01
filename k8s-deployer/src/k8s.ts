import * as Shell from "./shell-facade.js"
import { logger } from "./logger.js"
import { Namespace } from "./model.js"

const pad = (v: string | number, len: number = 2): string => {
  let result = `${ v }`
  while (result.length != len) result = `0${ result }`
  return result
}

export const generateNamespaceName = async (seqNumber: string, attempt: number = 1) => {
  const date = new Date()
  let namespaceName = "ns"
  namespaceName = `${ namespaceName }${ pad(date.getUTCMonth() + 1, 2) }`
  namespaceName = `${ namespaceName }${ pad(date.getUTCDate(), 2) }`
  namespaceName = `${ namespaceName }-${ seqNumber }-${ attempt }`
  return namespaceName
}

export const createNamespace = async (workspace: string, rootNamespace: Namespace, namespace: Namespace, timeoutSeconds: number) => {
  const logFile = `${ workspace }/logs/create-ns-${ namespace }.log`

  logger.info("Creating namespace: '%s'", namespace)
  const command = `k8s-deployer/scripts/k8s-manage-namespace.sh ${ rootNamespace } create "${ namespace }" ${ timeoutSeconds }`
  const timeoutMs = timeoutSeconds * 1_000
  await Shell.exec(command, { logFileName: logFile, tailTarget: logger.info, timeoutMs })

  logger.info("Namespace created: '%s'", namespace)
}

export const deleteNamespace = async (rootNamespace: Namespace, namespace: Namespace, timeoutSeconds: number, workspace: string) => {
  const logFile = `${ workspace }/delete-ns-${ namespace }.log`

  logger.info("Deleting namespace: '%s'", namespace)
  const timeoutMs = timeoutSeconds * 1_000
  const command = `k8s-deployer/scripts/k8s-manage-namespace.sh ${ rootNamespace } delete "${ namespace }" ${ timeoutSeconds }`
  await Shell.exec(command, { logFileName: logFile, tailTarget: logger.info, timeoutMs })
}