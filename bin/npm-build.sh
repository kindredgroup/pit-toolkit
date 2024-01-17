#!/bin/bash

set -e

package_name=$1

echo "Building $package_name"
cd $(pwd)/$package_name
npm ci
npm run build
npm run test
cd ../
