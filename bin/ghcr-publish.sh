#!/bin/bash

set -e

application=$1
version=$2
makeAdditionalTag=$3
gitHubToken=$4

if [ "${makeAdditionalTag}" == "" ];
then
  makeAdditionalTag="n"
fi

isNumber() {
  value="${1}"
  re='^[0-9]+$'
  if ! [[ "$value" =~ $re ]];
  then
    echo "0"
  else
    echo "1"
  fi
}

dockerBuildTagPush() {
  echo "all args = $@"
  application=$1
  version=$2
  additionalTag=$3

  echo "application=${application} version=${version} shouldBuild=${shouldBuild} additionalTag=${additionalTag}"

  tagWithVersion="$application:$version"
  echo "tagWithVersion=${tagWithVersion}"

  tagRef="ghcr.io/kindredgroup/pit-toolkit/$tagWithVersion"
  shortTagRef="ghcr.io/kindredgroup/pit-toolkit/$application:$additionalTag"
  appRef="ghcr.io/kindredgroup/pit-toolkit/$application"

  echo "tagRef=${tagRef}"
  echo ""

  echo "Docker images before tagging...."
  docker images

  echo "docker build --tag $tagRef ."
  docker build --tag "${tagRef}" .

  if [ "${additionalTag}" != "" ];
  then
    echo "shortTagRef=${shortTagRef}"
    docker tag "${tagRef}" "${shortTagRef}"
  fi

  echo "Docker images after tagging...."
  docker images

  echo "docker push -a ${appRef}"
  docker push -a "${appRef}"
  echo ""
}

home=$(pwd)
echo "cd $application"
cd $application
if [ "${makeAdditionalTag}" == "n" ];
then
  dockerBuildTagPush "${application}" "${version}"
  exit 0
fi

IFS="." && read -a array <<< "$version"
segmentsInVersion=$(echo "${#array[@]}")
echo "The number of segments in version is ${segmentsInVersion}..."
if [ $segmentsInVersion -lt 3 ]; then
  echo "There is no need to compute major and minor version as the number of segments is just: ${segmentsInVersion}"
  exit
fi

# check if any of the segments have words, if so, DO NOT produce additional tag.
makeAdditionalTag="y"

for i in "${!array[@]}"; do
  if [ $i -gt 0 ];
  then
    isNr=$(isNumber "${array[i]}")

    if [ "${isNr}" == 1 ]; then
      echo "the segment '${i}' is a number: ${array[i]}"
    else
      echo "the segment '${i}' is NOT a number: ${array[i]}"
      makeAdditionalTag="n"
      break
    fi
  fi
done

if [ "${makeAdditionalTag}" == "n" ];
then
  echo "Image will not be tagged with generic tag."
  exit
fi

# Create one more tag for the image
majorMinorVersion="${array[0]}.${array[1]}"
echo "Computed majorMinorVersion=${majorMinorVersion}"

dockerBuildTagPush "${application}" "${version}" "${majorMinorVersion}"

cd $home
git tag -f "${majorMinorVersion}"
git push -f origin tag "${majorMinorVersion}"
echo ""
