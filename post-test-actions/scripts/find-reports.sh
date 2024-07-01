#!/bin/bash

DIR=$1

find ${DIR} -name pit-report.json | grep -v "report_repo_tmp"