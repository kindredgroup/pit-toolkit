#!/bin/bash

REPORT_FILE=$1
TEST_SCRIPT=$2

k6 run -q --summary-export ./$REPORT_FILE $TEST_SCRIPT

tar cfz "./$REPORT_FILE.tgz" "./$REPORT_FILE"