#!/bin/bash

STATUS_DONE="Status=DONE"
STATUS_ERROR="Status=ERROR"
OVERWRITE_K8S_NAMESPACE=$1

if [ "${PIT_LOCK_MANAGER_ENV_FILE}" == "" ];
then
  PIT_LOCK_MANAGER_ENV_FILE=".env"
fi
echo "PIT_LOCK_MANAGER_ENV_FILE=${PIT_LOCK_MANAGER_ENV_FILE}"

cat $PIT_LOCK_MANAGER_ENV_FILE
set -o allexport
source $PIT_LOCK_MANAGER_ENV_FILE
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
echo ""
set +o allexport

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"

helm -n $K8S_NAMESPACE -ojson list

helm un -n $K8S_NAMESPACE $SERVICE_NAME
returnStatus=$(($?+0))

echo "returnStatus = ${returnStatus}"
if [ $returnStatus -ne 0 ];
then
  # This will signal to the monitor the stop event
  echo "$STATUS_ERROR"
  exit $returnStatus
fi

runningPods=$(kubectl get pods -n $K8S_NAMESPACE -oyaml -l app.kubernetes.io/name=$SERVICE_NAME -ojson | jq -c '.items | length')
echo "runningPods=${runningPods}"
while [ "$runningPods" != "0" ];
do
  kubectl get pods -n $K8S_NAMESPACE -l app.kubernetes.io/name=$SERVICE_NAME
  runningPods=$(kubectl get pods -n $K8S_NAMESPACE -oyaml -l app.kubernetes.io/name=$SERVICE_NAME -ojson | jq -c '.items | length')
  echo "runningPods=${runningPods}"
  sleep 10
done

# This will signal to the monitor the stop event
echo "$STATUS_DONE"