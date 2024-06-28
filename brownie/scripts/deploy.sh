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
  --set BROWNIE_DEPLOY_DEV_SECRET_STORE=${BROWNIE_DEPLOY_DEV_SECRET_STORE} \
  --set BROWNIE_NODE_OPTIONS=${BROWNIE_NODE_OPTIONS} \
  --set pod.repository=${REGISTRY_URL}/${SERVICE_NAME} \
  --set TIMESTAMP_PATTERN=${TIMESTAMP_PATTERN} \
  --set RETENTION_PERIOD=${RETENTION_PERIOD}"

# This function takes a list of server names and a list of properties to be configured for each server
# It is expected that env variables holding values of these properties are already exported. This function
# will prepare a long list of helm --set a=b statements, where "a" is property to be overwritten and set
# for chart, and "b" is the value of that property dynamically fetched from environment.
getModuleOverwrites() {
  CONFIG_NAMES=$1
  PROPERTIES=$2
  helmListName=$3
  CONFIGS=""
  configNamesAsArray=""
  if [ "${CONFIG_NAMES}" != "" ];
  then
    for cfgName in ${CONFIG_NAMES};
    do
      cfgUpperName=$(echo $cfgName | tr "[:lower:]" "[:upper:]")
      cfgLowerName=$(echo $cfgName | tr "[:upper:]" "[:lower:]")
      if [ "${configNamesAsArray}" != "" ]; then configNamesAsArray="${configNamesAsArray},"; fi
      configNamesAsArray="${configNamesAsArray}${cfgLowerName}"

      for settingName in $PROPERTIES;
      do
        varName="${cfgUpperName}_${settingName}"
        varValue=$(printenv "${varName}" | sed 's/,/\\,/g')
        CONFIGS="${CONFIGS} --set ${varName}=${varValue}"
      done
    done
    # this section prepares to pass all config names as a single array using helm syntax for arrays: --set something={v1,v2,v3} which is the same as having
    # this in the yaml something: [ "v1", "v2", "v3" ]. Chart needs this to do futher iteration using helm "range" function.
    configNamesAsArray="{${configNamesAsArray}}" # special syntax for arrays
    CONFIGS="${CONFIGS} --set ${helmListName}=${configNamesAsArray}"
  else
    for settingName in $PROPERTIES;
    do
      varValue=$(printenv "${settingName}")
      CONFIGS="${CONFIGS} --set ${settingName}=${varValue}"
    done
  fi
  echo "${CONFIGS}"
}

if [ "${POSTGRESQL_CONFIG_NAMES}" != "" ];
then
  POSTGRESQL_CONFIGS=$(getModuleOverwrites "${POSTGRESQL_CONFIG_NAMES}" "PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE" "POSTGRESQL_CONFIG_NAMES")
  HELM_OVERWRITES="${HELM_OVERWRITES} ${POSTGRESQL_CONFIGS}"
fi

if [ "${KAFKA_CONFIG_NAMES}" != "" ];
then
  KAFKA_CONFIGS=$(getModuleOverwrites "${KAFKA_CONFIG_NAMES}" "KAFKA_BROKERS KAFKA_PORT KAFKA_USERNAME KAFKA_PASSWORD SASL_MECHANISM")
  HELM_OVERWRITES="${HELM_OVERWRITES} ${KAFKA_CONFIGS}"
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
  echo "helm $HELM_TEMPLATE > \"./${SERVICE_NAME}-helm-debug.log\""
  helm $HELM_TEMPLATE > "./${SERVICE_NAME}-helm-debug.log"
fi

echo "Helm command is"
echo "helm $HELM_ARGS"

cat "./${SERVICE_NAME}-helm-debug.log"
#helm $HELM_ARGS
rm $CHART_PACKAGE