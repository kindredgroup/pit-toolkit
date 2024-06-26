#!/bin/bash

dryRun=$1
action=$2
dir=$3
tagName=$4

if [ "$dryRun" != "false" ];
then
  dryRun="true"
fi

if [ "$action" == "" ];
then
  echo "Missing the second parameter: action"
  exit 1
fi

if [ "$dir" == "" ];
then
  echo "Missing the third parameter: project directory"
  exit 1
fi

if [ "$action" != "read-tags" ];
then
  if [ "$action" != "delete-tag" ];
  then
    if [ "$action" != "add-tag" ];
    then
      echo "Unknown action. The 'action' must be one of 'read-tags', 'delete-tag', 'add-tag'. The current value is ${action}"
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
    echo "Missing the third parameter: tag name. Cannot delete tag."
    exit 1
  fi
  cd $dir
  git tag --delete $tagName

  if [ "$dryRun" == "false" ];
  then
    git push --delete origin $tagName
  else
    echo "DRY RUN mode is ON. The tag ${tagName} will not be delted from remote."
    echo "DRY RUN. git push --delete origin $tagName"
  fi
fi

if [ "$action" == "add-tag" ];
then
  cd $dir
  git tag $tagName
  if [ "$dryRun" == "false" ];
  then
    git push origin $tagName
  else
    echo "DRY RUN mode is ON. The tag ${tagName} will not be pushed to remote."
    echo "DRY RUN. git push origin $tagName"
  fi
fi