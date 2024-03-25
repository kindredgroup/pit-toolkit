#!/bin/bash

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# This script is intended to be invoked on the developer machine. It will collect 
# some input from user and proceed with bumping versions of apps, setting up tag 
# and finally bumping versions again. Below is the list of apps:
#  - brownie
#  - k8-deployer
#  - lock-manager
#
# Script will not proceed if project is not clean, not on "master" branch or
# current master differs from remote master.
#
# It will do the following: 
# - locally build node apps:

# - Bump node version of apps mentioned above, commit and tag project
# - Optionally, it will push out tags to the remote, hence triggering 
# - Creation and publishing of docker images.
#
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

set -e

line="- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -"

WORK_STATUS=$(git status --porcelain)
if [ "${WORK_STATUS}" != "" ];
then
  echo $line
  echo "Working directory must be clean. Currently it contains some changes!"
  echo $WORK_STATUS
  echo $line
  exit 1
fi

# Are we allowed to execute this script on the branch other than master?
ALLOW_BRANCH="n"
for param in $1
do
  case "$param" in
    "--allow-branch")
      ALLOW_BRANCH="yes"
      echo "Execution of this script on non-master branch is allowed"
    ;;
  esac
done

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$ALLOW_BRANCH" == "n" ];
then

  if [ "${CURRENT_BRANCH}" != "master" ];
  then
    echo $line
    echo "Current branch must be master!"
    echo $CURRENT_BRANCH
    echo $line
    exit 1
  else
    # refresh master branch
    echo "Fetching master from remote..."
    git fetch
    git pull

    returnStatus=$(($?+0))
    if [ $returnStatus -ne 0 ];
    then
      exit $returnStatus
    fi

    echo "Comparing current master with remote..."
    PUSH_STATUS=$(git diff HEAD origin/master --name-status)
    if [ "${PUSH_STATUS}" != "" ];
    then
      echo "There are comitted but not pushed changes in your current branch!!!"
      exit 1
    fi
  fi  # end of when on master

fi # end of allow branch

LATEST_TAG=$(git describe --abbrev=0 --tags)
LATEST_SEMVER=${LATEST_TAG/v/}

echo $line
echo ""
echo "CURRENT_BRANCH=$CURRENT_BRANCH"
echo "LATEST_TAG=$LATEST_TAG"
echo "LATEST_SEMVER=$LATEST_SEMVER"
echo ""

echo "Provide a new semver number. Type: 'a' or just press 'enter' for cancel and abort here."
echo "Otherwise type version number, for example, type '2.0.0' the tag name will be v2.0.0"
unset ANSWER
read ANSWER
if [ "${ANSWER}" == "a" ] || [ "${ANSWER}" == "" ];
then
  echo "Your answer was '${ANSWER}', aborting"
  exit 1
fi

echo "You answered '$ANSWER', validating ..."
echo ""

IFS='.' read -a segments <<< "$ANSWER"
len=${#segments[@]}
if [ $len -ne 3 ];
then
  echo "Invalid version format: '${ANSWER}'. We expect exactly three segments separated by dot."
  exit 1
fi

NEW_VERSION=$ANSWER

echo $line
echo "Provide the next version number (aka 'dev version' or 'shapshot')"
echo "Type: 'a' or just press 'enter' for cancel and abort here."
echo "Otherwise type the next version (witout suffix), for example, if you are releasing '2.0.0' then the next dev version will be '2.1.0'. We will add '-dev' suffix automatically"
unset ANSWER
read ANSWER
if [ "${ANSWER}" == "a" ] || [ "${ANSWER}" == "" ];
then
  echo "Your answer was '${ANSWER}', aborting"
  exit 1
fi

NEXT_VERSION=$(echo $ANSWER | sed 's/-dev//')-dev

echo $line
echo "The new version for release will be       : $NEW_VERSION"
echo "The next dev version after release will be: $NEXT_VERSION"
echo $line

echo "Proceed to bumping the project version? (type 'y' for 'Yes')"
unset ANSWER
read ANSWER
if [ "${ANSWER}" != "y" ];
then
  echo "Your answer was '${ANSWER}'"
  exit 1
fi

echo """
Bumping versions of all apps to $NEW_VERSION
  
Bumping versions of the following NPMs:
  - brownie       $NEW_VERSION
  - k8-deployer   $NEW_VERSION
  - lock-manager  $NEW_VERSION  
"""

versionApp() {
  application=$1
  version=$2
  isNextVersion=$3

  home=$(pwd)
  cd $application
  echo "Building ${application} in ${home}/${application}"

  if [ "${isNextVersion}" != "next" ];
  then
    npm run build
  fi

  echo "Bumping version of ${application} to ${version}"
  npm version $version

  cd $home
}

apps="'brownie', 'lock-manager', 'k8s-deployer'"

versionApp "brownie" $NEW_VERSION
versionApp "lock-manager" $NEW_VERSION
versionApp "k8s-deployer" $NEW_VERSION

git add --all
git commit -a -m "chore(npm): Release $NEW_VERSION of ${apps}" --no-verify

returnStatus=$(($?+0))

if [ $returnStatus -ne 0 ];
then
  echo "Exiting with build error"
  exit $returnStatus
fi

echo $line
echo "Tagging repostiory"
git tag -a -m "Release ${NEW_VERSION}" "v${NEW_VERSION}"
echo ""

echo $line
echo "Bumping development versions to $NEXT_VERSION"
echo ""

versionApp "brownie" "${NEXT_VERSION}" "next"
versionApp "lock-manager" "${NEXT_VERSION}" "next"
versionApp "k8s-deployer" "${NEXT_VERSION}" "next"

git add --all
git commit -a -m "chore(npm): Set dev version of ${apps} to $NEXT_VERSION" --no-verify

echo ""

git log --oneline -5

echo """
$line
Done. Please review all changes and manually push to remote.
(To undo changes use 'git rebase -i <sha>' and 'git tag -d <tag>')
$line
"""

