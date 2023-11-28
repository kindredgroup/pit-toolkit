#!/bin/bash

# Checks for pods to become available in the namespace

OVERWRITE_K8S_NAMESPACE=$1

set -o allexport
source .env
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
set +o allexport

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"

readyReplicas=$(\
  kubectl -n ${K8S_NAMESPACE} get deployments \
    -l app.kubernetes.io/name=${SERVICE_NAME} \
    -o json | \
    jq '.items[] | .status.readyReplicas')

readyReplicas=$(($readyReplicas+0))

echo "${SERVICE_NAME} has $readyReplicas ready replicas"

if [ $readyReplicas -eq 0 ];
then
  exit 1
fi

exit 0