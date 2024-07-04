#!/bin/bash

dryRun=$1
action=$2
dir=$3
tagName=$4

LOG_FILE="pta_tag-git-repository.log"

if [ "$dryRun" != "false" ];
then
  dryRun="true"
fi

if [ "$action" == "" ];
then
  echo "Missing the second parameter: action" >> $LOG_FILE
  exit 1
fi

if [ "$dir" == "" ];
then
  echo "Missing the third parameter: project directory" >> $LOG_FILE
  exit 1
fi

if [ "$action" != "read-tags" ];
then
  if [ "$action" != "delete-tag" ];
  then
    if [ "$action" != "add-tag" ];
    then
      echo "Unknown action. The 'action' must be one of 'read-tags', 'delete-tag', 'add-tag'. The current value is ${action}" >> $LOG_FILE
      exit 1
    fi
  fi
fi

if [ "$action" == "read-tags" ];
then
  cd $dir
  git show-ref --tags
fi

if [ "$action" == "delete-tag" ];
then
  if [ "$tagName" == "" ];
  then
    echo "Missing the third parameter: tag name. Cannot delete tag." >> $LOG_FILE
    exit 1
  fi
  cd $dir
  git tag --delete $tagName

  if [ "$dryRun" == "false" ];
  then
    if [ "${USER_NAME}" == "" ]; then echo "Git user name is required" >> $LOG_FILE; exit 1; fi
    if [ "${USER_EMAIL}" == "" ]; then echo "Git user email is required" >> $LOG_FILE; exit 1; fi

    cp .git/config .git/config_backup && \
      git config user.email "${USER_EMAIL}" && \
      git config user.name "${USER_NAME}" && \
      git push --delete origin $tagName && \
      mv .git/config_backup .git/config

  else
    echo "DRY RUN mode is ON. The tag ${tagName} will not be delted from remote." >> $LOG_FILE
    echo "DRY RUN. git push --delete origin $tagName" >> $LOG_FILE
  fi
fi

if [ "$action" == "add-tag" ];
then
  cd $dir
  git tag $tagName
  if [ "$dryRun" == "false" ];
  then
    if [ "${USER_NAME}" == "" ]; then echo "Git user name is required" >> $LOG_FILE; exit 1; fi
    if [ "${USER_EMAIL}" == "" ]; then echo "Git user email is required" >> $LOG_FILE; exit 1; fi

    cp .git/config .git/config_backup && \
      git config user.email "${USER_EMAIL}" && \
      git config user.name "${USER_NAME}" && \
      git push origin $tagName && \
      mv .git/config_backup .git/config >> $LOG_FILE

  else
    echo "DRY RUN mode is ON. The tag ${tagName} will not be pushed to remote." >> $LOG_FILE
    echo "DRY RUN. git push origin $tagName" >> $LOG_FILE
  fi
fi