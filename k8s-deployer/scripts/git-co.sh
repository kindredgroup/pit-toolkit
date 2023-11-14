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
        echo $(cd $dir; git checkout -b "branch_$ref" $ref)
    fi
fi

echo $(cd $dir; echo ''; git log --oneline -3)
ls -lah