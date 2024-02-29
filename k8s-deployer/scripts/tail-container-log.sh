#!/bin/bash

namespace=$1
service=$2
filter=$3

logFile="${namespace}_${service}_pod_${container}.log"

podId=$(kubectl get pods -n $namespace -l "app.kubernetes.io/name=${service}" --field-selector="status.phase=Running" -o jsonpath="{.items[].metadata.name}")

args="-f -n ${namespace} ${podId}"

if [ "${filter}" != "" ];
then
  args="${args} -l ${filter}"
fi

# the output will be caught by child node process whose parent is k8s-deployer
kubectl logs $args