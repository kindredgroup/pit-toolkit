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
PROJECT_ROOT=$(pwd)

echo "EXAMPLES_TEMP_DIR=$EXAMPLES_TEMP_DIR"
echo "PROJECT_DIR=$PROJECT_DIR"
echo "Current director is \"$PROJECT_ROOT\""

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

cd $EXAMPLES_TEMP_DIR
EXAMPLES_TEMP_DIR=$(pwd)

CI_HOME_DIR=$EXAMPLES_TEMP_DIR/ci-home
mkdir -p $CI_HOME_DIR

# Lets simulate the checkout of project as it is done by CI

clear='\033[0m'
grey='\033[0;90m'
echo -e "${grey}"
rsync -avhq --delete --executability $PROJECT_DIR $CI_HOME_DIR/
echo -e "${clear}"

cd $CI_HOME_DIR
APP_NAME=$(basename $PROJECT_DIR)
node $PROJECT_ROOT/dist/index.js --workspace $CI_HOME_DIR --pitfile $CI_HOME_DIR/$APP_NAME/pitfile.yml
returnStatus=$(($?+0))

cd $PROJECT_ROOT

exit $returnStatus