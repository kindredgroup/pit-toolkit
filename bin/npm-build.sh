#!/bin/bash

set -e

application=$1
home=$(pwd)

echo "Building $application"
cd $(pwd)/$application

npm ci
npm run build
npm run test

cd $home
