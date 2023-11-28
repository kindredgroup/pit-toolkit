#!/bin/bash

REPORT_FILE=$1
TEST_SCRIPT=$2

#k6 run -q --out ./$REPORT_FILE $TEST_SCRIPT

k6 run -q --out json="./$REPORT_FILE.tmp" $TEST_SCRIPT

cat "./$REPORT_FILE.tmp" | jq '. | select(.type=="Point" and .metric=="http_req_duration")' | jq '[inputs]' > ./$REPORT_FILE

tar cfz "./$REPORT_FILE.tgz" "./$REPORT_FILE"