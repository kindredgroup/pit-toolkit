#!/bin/bash

repo=$1
ref=$2
dir=$3

if [ "$repo" == "" ];
then
    echo "Missing the first parameter: Git repository URL"
    exit 1
fi

if [ "$ref" == "" ];
then
    echo "Missing the second parameter: Git repository reference (branch or tag or commit sha)"
    exit 1
fi

if [ "$dir" == "" ];
then
  echo "Missing the third parameter: Target directory where to checkout"
  exit 1
fi

checkoutTagOrBranch() {
    repo=$1
    ref=$2
    dir=$3
    git clone -q --single-branch -b $ref $repo $dir
}

if [[ $ref == "refs/tags/"* ]];
then
    ref=${ref/refs\/tags\//}
    checkoutTagOrBranch $repo $ref $dir
else
    if [[ $ref == "refs/remotes/origin/"* ]];
    then
        ref=${ref/refs\/remotes\/origin\//}
        checkoutTagOrBranch $repo $ref $dir
    else
        # ref must just be sha
        git clone -q $repo $dir
        $(cd $dir; git checkout -q -b "branch_$ref" $ref)
    fi
fi

COMMIT_SHA=$(cd $dir && git log --pretty=format:"%h" -1)

echo "COMMIT_SHA=${COMMIT_SHA}"