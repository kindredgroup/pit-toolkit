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
WORKSPACE=$1
PROJECT_DIR=$2
PROJECT_ROOT=$(pwd)

echo "WORKSPACE=$WORKSPACE"
echo "PROJECT_DIR=$PROJECT_DIR"
echo "Current director is \"$PROJECT_ROOT\""

if [ "${WORKSPACE}" == "" ];
then
  echo "Missing first parameter: the workspace location"
  exit 1
fi

if [ ! -d "${WORKSPACE}" ];
then
  echo "Creating workspace"
  WORKSPACE="tmp/workspace"
  mkdir -p $WORKSPACE || true
fi

cd $WORKSPACE
WORKSPACE=$(pwd)

mkdir $WORKSPACE/ci-home

clear='\033[0m'
grey='\033[0;90m'
echo -e "${grey}"
rsync -avh --executability --progress $PROJECT_DIR/ $WORKSPACE/ci-home/
echo -e "${clear}"

node $PROJECT_ROOT/dist/index.js --workspace $WORKSPACE --pitfile $PROJECT_DIR/pitfile.yml
returnStatus=$(($?+0))

cd $PROJECT_ROOT

exit $returnStatus