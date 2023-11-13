#!/bin/bash

# Checks for pods to become available in the namespace

set -o allexport
source ../.env
set +o allexport

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