#!/bin/bash

set -e

package_name=$1
version=$2
make_additional_tag=$3

if [ "${make_additional_tag}" == "" ];
then
  make_additional_tag="n"
fi

is_number() {
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
  package_name=$1
  version=$2

  tag_with_version=$package_name:$version
  echo "tag_with_version=${tag_with_version}"

  tag_ref=ghcr.io/kindredgroup/pit-toolkit/$tag_with_version
  echo "tag_ref=${tag_ref}"
  echo ""

  pwd
  echo ""
  ls -lah
  echo ""

  echo "docker build --tag $tag_ref ."
  docker build --tag "${tag_ref}" .
  echo "docker push ${tag_ref}"
  docker push "${tag_ref}"
  echo ""
}

home=$(pwd)
echo "cd $package_name"
cd $package_name
push_tag "${package_name}" "${version}"

if [ "${make_additional_tag}" == "n" ];
then
  exit 0
fi

IFS="." && read -a array <<< "$version"
segments_in_version=$(echo "${#array[@]}")
echo "The number of segments in version is ${segments_in_version}..."
if [ $segments_in_version -lt 3 ]; then
  echo "There is no need to compute major and minor version as the number of segments is just: ${segments_in_version}"
  exit
fi

# check if any of the segments have words, if so, DO NOT produce additional tag.
make_additional_tag="y"

for i in "${!array[@]}"; do
  if [ $i -gt 0 ];
  then
    is_nr=$(is_number "${array[i]}")

    if [ "${is_nr}" == 1 ]; then
      echo "the segment '${i}' is a number: ${array[i]}"
    else
      echo "the segment '${i}' is NOT a number: ${array[i]}"
      make_additional_tag="n"
      break
    fi
  fi
done

if [ "${make_additional_tag}" == "n" ];
then
  echo "Image will not be tagged with generic tag."
  exit
fi

# Create one more tag for the image
major_minor_version="${array[0]}.${array[1]}"
echo "Computed major_minor_version=${major_minor_version}"

push_tag "${package_name}" "${major_minor_version}"

cd $home

git tag -f "${major_minor_version}"
git push origin tag "${major_minor_version}"