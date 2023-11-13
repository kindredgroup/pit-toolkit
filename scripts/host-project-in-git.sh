#!/bin/bash
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# This scirpts takes pathof the project and exposes it through locally running
# git server. Useful when testing PIT functionality which expect location.type
# to be REMOTE.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

WORKSPACE=$1
PROJECT_DIR=$2
PORT=$3

if [ "$PORT" == "" ];
then
  PORT=60100
  echo "Using default port: $PORT"
fi

echo "PROJECT_DIR=$PROJECT_DIR"
echo "WORKSPACE=$WORKSPACE"
echo "PORT=$PORT"
echo "GIT_SERVER_HOME=$WORKSPACE/git-server"

if [ ! -d "$PROJECT_DIR" ];
then
  echo "No such directory: $PROJECT_DIR"
  exit 1
fi

if [ ! -d "$WORKSPACE" ];
then
  echo "No such directory: $WORKSPACE"
  exit 1
fi

CURRENT_DIR=$(pwd)
GIT_SERVER_HOME="$WORKSPACE/git-server"

TMP_PATH="$GIT_SERVER_HOME/$(basename $PROJECT_DIR).git/tmp"
echo "TMP_PATH=$TMP_PATH"

mkdir -p $TMP_PATH

(cd $TMP_PATH; git init)
returnStatus=$(($?+0))
if [ $returnStatus -ne 0 ];
then
  exit $returnStatus
fi

cp -R $PROJECT_DIR/ $TMP_PATH/
cd $TMP_PATH
git checkout -b master
git add --all
git commit -a -m "Initial commit"

cd ..
mv ./tmp/.git .git
rm -rf ./tmp
cd .git
git config core.bare true

cd $CURRENT_DIR

git daemon --export-all --port=$PORT --base-path=$GIT_SERVER_HOME