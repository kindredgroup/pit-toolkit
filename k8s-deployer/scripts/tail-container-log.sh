#!/bin/bash

namespace=$1
service=$2
containerName=$3
filter=$4
logFileBase=$5

podIds=$(kubectl get pods -n $namespace -l "app.kubernetes.io/name=${service}" --field-selector="status.phase=Running" -o jsonpath="{.items[*].metadata.name}")

for podId in $podIds; do
  args="-f -n ${namespace} ${podId}"

  if [ "${containerName}" != "" ]; then
    args="${args} -c ${containerName}"
  fi

  if [ "${filter}" != "" ]; then
    args="${args} -l ${filter}"
  fi

  if [ "${logFileBase}" != "" ]; then
    kubectl logs $args >> "${logFileBase}-${podId}.log" 2>&1 &
  else
    # the output will be caught by child node process whose parent is k8s-deployer
    kubectl logs $args &
  fi
done

wait
