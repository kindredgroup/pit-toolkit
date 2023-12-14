#!/bin/bash

# Checks for pods to become available in the namespace

OVERWRITE_K8S_NAMESPACE=$1

if [ "${PIT_NODE_1_TEST_APP_ENV_FILE}" == "" ];
then
  PIT_NODE_1_TEST_APP_ENV_FILE=$PIT_NODE_1_ENV_FILE
  if [ "${PIT_NODE_1_TEST_APP_ENV_FILE}" == "" ];
  then
    PIT_NODE_1_TEST_APP_ENV_FILE="../.env"
  fi
fi
echo "PIT_NODE_1_TEST_APP_ENV_FILE=${PIT_NODE_1_TEST_APP_ENV_FILE}"

set -o allexport
source $PIT_NODE_1_TEST_APP_ENV_FILE
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
set +o allexport

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"

readyReplicas=$(\
  kubectl -n ${K8S_NAMESPACE} get deployments \
    -l app.kubernetes.io/name=${TEST_APP_SERVICE_NAME} \
    -o json | \
    jq '.items[] | .status.readyReplicas')

readyReplicas=$(($readyReplicas+0))

echo "${TEST_APP_SERVICE_NAME} has $readyReplicas ready replicas"

if [ $readyReplicas -eq 0 ];
then
  exit 1
fi

exit 0