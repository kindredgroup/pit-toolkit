#!/bin/bash

set -e

application=$1
version=$2
makeAdditionalTag=$3

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

push_tag() {
  echo "all args = $@"
  application=$1
  version=$2

  tagWithVersion=$application:$version
  echo "tagWithVersion=${tagWithVersion}"

  tagRef=ghcr.io/kindredgroup/pit-toolkit/$tagWithVersion
  echo "tagRef=${tagRef}"
  echo ""

  pwd
  echo ""
  ls -lah
  echo ""

  echo "docker build --tag $tagRef ."
  docker build --tag "${tagRef}" .
  echo "docker push ${tagRef}"
  docker push "${tagRef}"
  echo ""
}

home=$(pwd)
echo "cd $application"
cd $application
push_tag "${application}" "${version}"

if [ "${makeAdditionalTag}" == "n" ];
then
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

push_tag "${application}" "${majorMinorVersion}"

cd $home

git tag -f "${majorMinorVersion}"
git push origin tag "${majorMinorVersion}"
