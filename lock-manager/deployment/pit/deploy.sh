#!/bin/bash

STATUS_DONE="Status=DONE"
STATUS_ERROR="Status=ERROR"
OVERWRITE_K8S_NAMESPACE=$1
WEB_APP_CONTEXT_ROOT=$2

if [ "${PIT_LOCK_MANAGER_ENV_FILE}" == "" ];
then
  PIT_LOCK_MANAGER_ENV_FILE=".env"
fi
echo "PIT_LOCK_MANAGER_ENV_FILE=${PIT_LOCK_MANAGER_ENV_FILE}"

set -o allexport
source $PIT_LOCK_MANAGER_ENV_FILE
echo ""
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
set +o allexport

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"
echo "WEB_APP_CONTEXT_ROOT=${WEB_APP_CONTEXT_ROOT}"

# echo "D: ----------------------------"
# env | sort
# echo "D: ----------------------------"

CHART_PACKAGE="${SERVICE_NAME}-0.1.0.tgz"

HELM_OVERWRITES="--set CONTAINER_PORT=${CONTAINER_PORT} \
  --set ENABLE_INGRESS=${ENABLE_INGRESS} \
  --set EXTERNAL_SECRET_DB_PATH=${EXTERNAL_SECRET_DB_PATH} \
  --set SECRET_STORE_NAME=${SECRET_STORE_NAME} \
  --set IMAGE_TAG=${IMAGE_TAG} \
  --set SERVICE_NAME=${SERVICE_NAME} \
  --set PG_MIN_POOL_SIZE=${PG_MIN_POOL_SIZE} \
  --set PGDATABASE=${PGDATABASE} \
  --set PGHOST=${PGHOST} \
  --set PGPORT=${PGPORT} \
  --set PGUSER=${PGUSER} \
  --set PGPASSWORD=${PGPASSWORD} \
  --set PIT_LOCK_MANAGER_DEPLOY_DEV_SECRET_STORE=${PIT_LOCK_MANAGER_DEPLOY_DEV_SECRET_STORE} \
  --set LOCK_MANAGER_NODE_OPTIONS=${LOCK_MANAGER_NODE_OPTIONS} \
  --set pod.repository=${REGISTRY_URL}/${SERVICE_NAME}"

if [ "${ENABLE_INGRESS}" != "true" ];
then
  HELM_OVERWRITES="${HELM_OVERWRITES} --set webApp.contextRoot=${K8S_NAMESPACE}.${WEB_APP_CONTEXT_ROOT}"
fi

HELM_ARGS="upgrade --install --atomic --timeout 120s --namespace ${K8S_NAMESPACE}"
HELM_TEMPLATE="template --debug --namespace ${K8S_NAMESPACE}"

if [ "${PIT_DEBUG_HELM}" == "true" ];
then
  HELM_ARGS="${HELM_ARGS} --debug"
fi

HELM_ARGS="${HELM_ARGS} ${HELM_OVERWRITES} ${SERVICE_NAME} ./${CHART_PACKAGE}"
HELM_TEMPLATE="${HELM_TEMPLATE} ${HELM_OVERWRITES} ${SERVICE_NAME} ./${CHART_PACKAGE}"

helm package ./deployment/helm --debug --app-version=$IMAGE_TAG
if [ "${PIT_DEBUG_HELM}" == "true" ];
then
  helm $HELM_TEMPLATE > "./${SERVICE_NAME}-helm-debug.log"
fi

echo "Helm command is"
echo "helm $HELM_ARGS"

helm $HELM_ARGS
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