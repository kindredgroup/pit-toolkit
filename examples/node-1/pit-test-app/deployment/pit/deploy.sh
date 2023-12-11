#!/bin/bash

STATUS_DONE="Status=DONE"
STATUS_ERROR="Status=ERROR"
OVERWRITE_K8S_NAMESPACE=$1
WEB_APP_CONTEXT_ROOT=$2

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
echo ""
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
set +o allexport

TARGET_SERVICE_URL="http://$SERVICE_NAME:$SERVICE_PORT"

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"
echo "TEST_APP_SERVICE_NAME=${TEST_APP_SERVICE_NAME}"
echo "WEB_APP_CONTEXT_ROOT=${WEB_APP_CONTEXT_ROOT}"
echo "TARGET_SERVICE_URL=${TARGET_SERVICE_URL}"

# echo "D: ----------------------------"
# env | sort
# echo "D: ----------------------------"

CHART_PACKAGE="$TEST_APP_SERVICE_NAME-0.1.0.tgz"
helm package ./deployment/helm --debug --app-version=$IMAGE_TAG
helm upgrade --install \
  --atomic \
  --timeout 60s \
  --namespace $K8S_NAMESPACE \
  --set image.tag=$IMAGE_TAG \
  --set pod.repository=$REGISTRY_URL/$TEST_APP_SERVICE_NAME \
  --set service.port=$TEST_APP_SERVICE_PORT \
  --set environment.TARGET_SERVICE_URL=$TARGET_SERVICE_URL \
  --set webApp.contextRoot=$K8S_NAMESPACE.$WEB_APP_CONTEXT_ROOT \
  $TEST_APP_SERVICE_NAME ./$CHART_PACKAGE
returnStatus=$(($?+0))
rm $CHART_PACKAGE

echo "returnStatus = ${returnStatus}"
if [ $returnStatus -ne 0 ];
then
  # This will signal to the monitor the stop event
  echo "$STATUS_ERROR"
  exit $returnStatus
fi

result=$(helm --namespace $K8S_NAMESPACE status $TEST_APP_SERVICE_NAME | grep "STATUS")
if [ "${result}" != "STATUS: deployed" ];
then
  echo "result=${result}"
  helm --namespace $K8S_NAMESPACE status $TEST_APP_SERVICE_NAME
  echo "$STATUS_ERROR"
  exit 1
fi

# This will signal to the monitor the stop event
echo "$STATUS_DONE"