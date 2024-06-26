#!/bin/bash

set -e

OVERWRITE_K8S_NAMESPACE=$1
if [ "${BROWNIE_ENV_FILE}" == "" ];
then
  BROWNIE_ENV_FILE=".env"
fi
echo "BROWNIE_ENV_FILE=${BROWNIE_ENV_FILE}"

set -o allexport
source $BROWNIE_ENV_FILE
echo ""
if [ "$OVERWRITE_K8S_NAMESPACE" != "" ];
then
  K8S_NAMESPACE="$OVERWRITE_K8S_NAMESPACE"
fi
set +o allexport

KAFKA_BROKERS=$(echo "${KAFKA_BROKERS}" | sed 's/,/\\,/g')
TIMESTAMP_PATTERN=$(echo "${TIMESTAMP_PATTERN}" | sed 's/,/\\,/g')
ENABLED_MODULES=$(echo "${ENABLED_MODULES}" | sed 's/,/\\,/g')

echo "K8S_NAMESPACE=${K8S_NAMESPACE}"
CHART_PACKAGE="${SERVICE_NAME}-0.1.0.tgz"

HELM_OVERWRITES="\
  --set DRY_RUN=${DRY_RUN} \
  --set ENABLED_MODULES=${ENABLED_MODULES} \
  --set EXTERNAL_SECRET_DB_PATH=${EXTERNAL_SECRET_DB_PATH} \
  --set EXTERNAL_SECRET_KAFKA_PATH=${EXTERNAL_SECRET_KAFKA_PATH} \
  --set SECRET_STORE_NAME=${SECRET_STORE_NAME} \
  --set IMAGE_TAG=${IMAGE_TAG} \
  --set SERVICE_NAME=${SERVICE_NAME} \
  --set PGDATABASE=${PGDATABASE} \
  --set PGHOST=${PGHOST} \
  --set PGPORT=${PGPORT} \
  --set PGUSER=${PGUSER} \
  --set PGPASSWORD=${PGPASSWORD} \
  --set KAFKA_BROKERS=${KAFKA_BROKERS} \
  --set KAFKA_PORT=${KAFKA_PORT} \
  --set KAFKA_USERNAME=${KAFKA_USERNAME} \
  --set KAFKA_PASSWORD=${KAFKA_PASSWORD} \
  --set BROWNIE_DEPLOY_DEV_SECRET_STORE=${BROWNIE_DEPLOY_DEV_SECRET_STORE} \
  --set BROWNIE_NODE_OPTIONS=${BROWNIE_NODE_OPTIONS} \
  --set pod.repository=${REGISTRY_URL}/${SERVICE_NAME} \
  --set TIMESTAMP_PATTERN=${TIMESTAMP_PATTERN} \
  --set RETENTION_PERIOD=${RETENTION_PERIOD}"

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
  echo "helm $HELM_TEMPLATE > \"./${SERVICE_NAME}-helm-debug.log\""
  helm $HELM_TEMPLATE > "./${SERVICE_NAME}-helm-debug.log"
fi

echo "Helm command is"
echo "helm $HELM_ARGS"

helm $HELM_ARGS
rm $CHART_PACKAGE