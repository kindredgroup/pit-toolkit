#!/bin/bash

set -e

package_name=$1

echo $(pwd)
cd $(pwd)/$package_name
npm install
npm run build
npm run test
cd ../
