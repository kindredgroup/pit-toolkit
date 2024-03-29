#!/bin/bash

STATUS_DONE="Status=DONE"
STATUS_ERROR="Status=ERROR"
OVERWRITE_K8S_NAMESPACE=$1
OVERWRITE_SERVICE_PORT=$2

if [ "${PIT_NODE_1_ENV_FILE}" == "" ];
then
  PIT_NODE_1_ENV_FILE=".env"
fi
echo "PIT_NODE_1_ENV_FILE=${PIT_NODE_1_ENV_FILE}"

cat $PIT_NODE_1_ENV_FILE
set -o allexport
source $PIT_NODE_1_ENV_FILE
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
if [ "$OVERWRITE_SERVICE_PORT" != "" ];
then
  SERVICE_PORT="$OVERWRITE_SERVICE_PORT"
fi
echo ""
set +o allexport

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"

# echo "D: ----------------------------"
# env | sort
# echo "D: ----------------------------"

CHART_PACKAGE="$SERVICE_NAME-0.1.0.tgz"
helm package ./deployment/helm --debug --app-version=$IMAGE_TAG
helm upgrade --install \
  --atomic \
  --timeout 60s \
  --namespace $K8S_NAMESPACE \
  --set image.tag=$IMAGE_TAG \
  --set pod.repository=$REGISTRY_URL/$SERVICE_NAME \
  --set service.port=$SERVICE_PORT \
  $SERVICE_NAME ./$CHART_PACKAGE
returnStatus=$(($?+0))
rm $CHART_PACKAGE

echo "returnStatus = ${returnStatus}"
if [ $returnStatus -ne 0 ];
then
  # This will signal to the monitor the stop event
  echo "$STATUS_ERROR"
  exit $returnStatus
fi

# This will signal to the monitor the stop event
echo "$STATUS_DONE"