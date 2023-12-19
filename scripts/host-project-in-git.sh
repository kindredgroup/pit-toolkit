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

PROJECT_DIR_ON_GIT_SERVER="$GIT_SERVER_HOME/$(basename $PROJECT_DIR).git"
echo "PROJECT_DIR_ON_GIT_SERVER=$PROJECT_DIR_ON_GIT_SERVER"

if [ "$PROJECT_DIR_ON_GIT_SERVER" != "" ];
then
  rm -rf $PROJECT_DIR_ON_GIT_SERVER
fi

TMP_PATH="$PROJECT_DIR_ON_GIT_SERVER/tmp"
echo "TMP_PATH=$TMP_PATH"

mkdir -p $TMP_PATH

(cd $TMP_PATH; git init)
returnStatus=$(($?+0))
if [ $returnStatus -ne 0 ];
then
  exit $returnStatus
fi

rsync -avhq --executability --exclude .git/hooks --exclude node_modules --exclude dist --exclude tmp $PROJECT_DIR/ $TMP_PATH/
cd $TMP_PATH
echo ""
git branch
git checkout -b tmp_current

git branch -D master
git branch -m master
git branch
cat deployment/pit/deploy.sh
git checkout master && git add --all && git commit -a -m "Initial commit" 1> /dev/null

cd ..
mv ./tmp/.git .git
rm -rf ./tmp
cd .git
git config --bool core.bare true

cd $CURRENT_DIR

echo ""
echo "Launching git server. Checkout your project from git://127.0.0.1:${PORT}/$(basename $PROJECT_DIR).git"
echo ""
git daemon --export-all --enable=receive-pack --port=$PORT --base-path=$GIT_SERVER_HOME 