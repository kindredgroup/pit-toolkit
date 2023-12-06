#!/bin/bash
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# Starts k8s-deployer application.
#
# This script pretends that it runs on CI. It will simulate "checkout"
# of the PROJECT into workspace as if it was done by CI.
#
# Input:
# 1. Workspace directory for deployer. Should be empty.
# 2. Path to the directory where we have source code of the PROJECT.
#
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

echo "Starting k8s-deployer application..."

# There is no need to validate parameters, application will take care of it
EXAMPLES_TEMP_DIR=$1
# The project where push happened. For example directory pointing to node-1 in the examples.
PROJECT_DIR=$2
LOCK_MANAGER_MOCK=$3
PROJECT_ROOT=$(pwd)
APP_NAME=$(basename $PROJECT_DIR)
PARENT_NS=dev
COMMIT_SHA=$(git rev-parse --short HEAD)

echo "EXAMPLES_TEMP_DIR=$EXAMPLES_TEMP_DIR"
echo "PROJECT_DIR=$PROJECT_DIR"
echo "LOCK_MANAGER_MOCK=$LOCK_MANAGER_MOCK"
echo "Current director is \"$PROJECT_ROOT\""
echo "Application under test is \"$APP_NAME\""
echo "Parent namespace \"$PARENT_NS\""
echo "Simulated CI commit \"$COMMIT_SHA\""

if [ "${EXAMPLES_TEMP_DIR}" == "" ];
then
  echo "Missing first parameter: the temporary directory to be used when running examples"
  exit 1
fi

if [ ! -d "${EXAMPLES_TEMP_DIR}" ];
then
  echo "Creating temporary directory"
  EXAMPLES_TEMP_DIR="tmp"
  mkdir $EXAMPLES_TEMP_DIR || true
fi

# check LOCK_MANAGER_MOCK else set process envvar to true
if [ "${LOCK_MANAGER_MOCK}" == "" ];
then
  echo "Missing third parameter: boolean to use lock-manager-mock"
  export LOCK_MANAGER_MOCK=false
fi

cd $EXAMPLES_TEMP_DIR
EXAMPLES_TEMP_DIR=$(pwd)

CI_HOME_DIR=$EXAMPLES_TEMP_DIR/ci-home
mkdir -p $CI_HOME_DIR

# Lets simulate the checkout of project as it is done by CI

clear='\033[0m'
green='\033[1;32m'
grey='\033[0;90m'

echo -e "${green}"
echo "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -"

echo "simulating CI activity: checkout of k8s-deployer app"
echo -e "${grey}"
rsync -avhq --delete --executability $PROJECT_ROOT/../k8s-deployer $CI_HOME_DIR/
ls -lah $CI_HOME_DIR

echo -e "${green}"
echo "simulating CI activity: checkout of lock-manager app"
echo -e "${grey}"
rsync -avhq --delete --executability $PROJECT_ROOT/../lock-manager $CI_HOME_DIR/
ls -lah $CI_HOME_DIR

echo -e "${green}"
echo "simulating CI activity: checkout of $APP_NAME app"
echo -e "${grey}"
rsync -avhq --delete --executability $PROJECT_DIR $CI_HOME_DIR/
ls -lah $CI_HOME_DIR

echo -e "${green}"
echo "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -"
echo ""
echo "Launching k8s-deployer"
echo ""
echo -e "${clear}"

cd $CI_HOME_DIR
node $PROJECT_ROOT/dist/src/index.js \
  --commit-sha $COMMIT_SHA \
  --workspace $CI_HOME_DIR \
  --pitfile $CI_HOME_DIR/$APP_NAME/pitfile.yml \
  --parent-ns $PARENT_NS \
  --report-repository "git://127.0.0.1:60102/pit-reports.git" \
  --report-branch-name $(basename $PROJECT_DIR) \
  --lock-manager-mock $LOCK_MANAGER_MOCK

returnStatus=$(($?+0))

cd $PROJECT_ROOT

exit $returnStatus