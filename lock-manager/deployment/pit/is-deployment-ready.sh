#!/bin/bash

# Checks for pods to become available in the namespace

OVERWRITE_K8S_NAMESPACE=$1

if [ "${PIT_LOCK_MANAGER_ENV_FILE}" == "" ];
then
  PIT_LOCK_MANAGER_ENV_FILE=".env"
fi
echo "PIT_LOCK_MANAGER_ENV_FILE=${PIT_LOCK_MANAGER_ENV_FILE}"

set -o allexport
source $PIT_LOCK_MANAGER_ENV_FILE
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
set +o allexport

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"
echo "SERVICE_PORT=${SERVICE_PORT}"

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