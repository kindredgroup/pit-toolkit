#!/bin/bash

STATUS_DONE="Status=DONE"
STATUS_ERROR="Status=ERROR"
OVERWRITE_K8S_NAMESPACE=$1
WEB_APP_CONTEXT_ROOT=$2

cat .env
set -o allexport
source .env
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
echo ""
set +o allexport

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"
echo "WEB_APP_CONTEXT_ROOT=${WEB_APP_CONTEXT_ROOT}"

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
  --set webApp.contextRoot=$K8S_NAMESPACE.$WEB_APP_CONTEXT_ROOT \
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

#http://localhost:80/ns1201_1_1.lock-manager/

# This will signal to the monitor the stop event
echo "$STATUS_DONE"