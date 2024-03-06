import * as Shell from "./shell-facade.js"
import { logger } from "./logger.js"
import { Namespace } from "./model.js"
import * as cfg from "./config.js"

const pad = (v: string | number, len: number = 2): string => {
  let result = `${ v }`
  while (result.length != len) result = `0${ result }`
  return result
}

export const generateNamespaceName = async (config: cfg.Config, seqNumber: string, attempt: number = 1) => {
  let namespaceName = config.subNamespacePrefix

  if (config.subNamespaceGeneratorType == cfg.SUB_NAMESPACE_GENERATOR_TYPE_DATE) {
    const date = new Date()

    namespaceName = `${ namespaceName }${ pad(date.getUTCMonth() + 1, 2) }`
    namespaceName = `${ namespaceName }${ pad(date.getUTCDate(), 2) }`
    namespaceName = `${ namespaceName }-${ seqNumber }-${ attempt }`
  } else if (config.subNamespaceGeneratorType == cfg.SUB_NAMESPACE_GENERATOR_TYPE_COMMITSHA) {
    namespaceName = `${ namespaceName }-${ config.commitSha }-${ seqNumber }-${ attempt }`
  }

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
  const logFile = `${ workspace }/logs/delete-ns-${ namespace }.log`

  logger.info("Deleting namespace: '%s'", namespace)
  const timeoutMs = timeoutSeconds * 1_000
  const command = `k8s-deployer/scripts/k8s-manage-namespace.sh ${ rootNamespace } delete "${ namespace }" ${ timeoutSeconds }`
  await Shell.exec(command, { logFileName: logFile, tailTarget: logger.info, timeoutMs })
}

export class ServiceUrlOptions {
  exposedViaProxy?: boolean
  servicePort?: number
}

export const makeServiceUrl = (clusterUrl: string, namespace: Namespace, service: string, testId?: string, options?: ServiceUrlOptions) => {
  if (options?.exposedViaProxy) {
    const url = `${ clusterUrl }/api/v1/namespaces/${ namespace }/services/${ service }`
    const servicePort = options.servicePort || 80
    return `${ url }:${ servicePort }/proxy`
  }

  let serviceName = testId || service
  // This is exposed via NGINX Ingress, "service" here is test suite id
  return `${ clusterUrl }/${ namespace }.${ serviceName }`
}