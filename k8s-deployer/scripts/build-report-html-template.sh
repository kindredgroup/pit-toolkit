#!/bin/bash
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# Builds report UI into single page app and
# copies result into "./report-template.html"
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

set -e

currentDir=$(pwd)
cd ../pit-report-ui

npm run build-template

cd $currentDir
cp ../pit-report-ui/single-dist/index.html $currentDir/report-template.html