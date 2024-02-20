#!/bin/bash

HOME_DIR=$1         # current directory where script will be executing
CONTENT_DIR=$2      # relative to HOME_DIR
GIT_REPO=$3         # publish location
BRANCH_NAME=$4
PUBLISH_DIR=$5      # the directory in the project where new report will be stored
COMMIT_MESSAGE=$6

STATUS_DONE="Status=DONE"
STATUS_ERROR="Status=ERROR"

echo "HOME_DIR=${HOME_DIR}"
echo "CONTENT_DIR=${CONTENT_DIR}"
echo "GIT_REPO=${GIT_REPO}"
echo "BRANCH_NAME=${BRANCH_NAME}"
echo "PUBLISH_DIR=${PUBLISH_DIR}"
echo "COMMIT_MESSAGE=${COMMIT_MESSAGE}"
echo "USERNAME=${USERNAME}"

if [ "${GIT_REPO}" == "" ];
then
  echo "Git repository is required"
  echo "${STATUS_ERROR}"
  exit 1
fi

if [ "${BRANCH_NAME}" == "" ];
then
  echo "Reports branch name is required"
  echo "${STATUS_ERROR}"
  exit 1
fi

if [ "${USERNAME}" == "" ];
then
  echo "The git username is required, it will be used for --author argument in 'git commit' command"
  echo "${USERNAME}"
  exit 1
fi

if [ "${CONTENT_DIR}" == "" ];
then
  echo "Content directory is required"
  echo "${STATUS_ERROR}"
  exit 1
fi

if [ "${COMMIT_MESSAGE}" == "" ];
then
  echo "The commit message is required"
  echo "${COMMIT_MESSAGE}"
  exit 1
fi

# The caller is expected to set "USERNAME" env variable
AUTHOR_ARG="${USERNAME} <${USERNAME}@kindredgroup.com>"

cp .git/config ./git/config_backup
git config user.email "${USERNAME}@kindredgroup.com"
git config user.name "${USERNAME}"

CONTENT_DIR_PATH="${HOME_DIR}/${CONTENT_DIR}"
if [ ! -d "${CONTENT_DIR_PATH}" ];
then
  echo "'${CONTENT_DIR_PATH}' does not exist"
  echo "${STATUS_ERROR}"
  exit 1
fi

mkdir -p "${HOME_DIR}/report_repo_tmp"
echo "navigting to ${HOME_DIR}/report_repo_tmp"
cd "${HOME_DIR}/report_repo_tmp"
CONTENT_DIR_PATH="../${CONTENT_DIR}"
pwd

git clone $GIT_REPO . && \
  git checkout -b $BRANCH_NAME "origin/${BRANCH_NAME}" && \
  mkdir $PUBLISH_DIR && \
  cp -R $CONTENT_DIR_PATH/* $PUBLISH_DIR && \
  git add --all && \
  git status && \
  git commit --author "${AUTHOR_ARG}" -a -m "${COMMIT_MESSAGE}" && \
  git push -u origin $BRANCH_NAME && \
  mv ./git/config_backup ./git/config

resultStatus=$(($?+0))

if [ $resultStatus -ne 0 ];
then
  echo "${STATUS_ERROR}"
  exit 1
fi

echo "${STATUS_DONE}"
exit 0