#!/bin/bash

set -e
package_name=$1
version=$2
echo $(pwd)
cd $package_name
tag_with_version=pit-$package_name:$version
tag_ref=ghcr.io/kindredgroup/pit-toolkit/$tag_with_version
echo $tag_ref
docker build . --tag $tag_ref
#for ghcr.io access token mentioned in the github secrets and accessed in actions
docker push $tag_ref
