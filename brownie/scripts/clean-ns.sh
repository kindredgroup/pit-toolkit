#!/bin/bash
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# This script is invoked from the periodic CI pipeline. It will fetch the list of children
# namespaces the kubernetes and pass that list into the node app. The node app will determine
# whether the namespace is old and should be removed or it hasn't been aged yet and should be
# kept in the cluster. If the "--dry-run" parameter is "false" then old namespaces will be removed.
# The actual removeal of namespace is delegeated to
# ../k8s-deployer/scripts/k8s-manage-namespace.sh
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
K8S_NAMESPACE=$1
BROWNIE_TIMEOUT=$2
DRY_RUN=$3

if [ "${DRY_RUN}" == "" ]; then DRY_RUN="true"; fi

usage="Example: $0 my-parent-namespace 3days"
if [ "${K8S_NAMESPACE}" == "" ];
then
  echo "Missing 1st parameter namespace"
  echo $usage
  exit 1
fi

if [ "${BROWNIE_TIMEOUT}" == "" ];
then
  echo "Missing 2nd parameter namespace retention period"
  echo $usage
  exit 1
fi

LOG_FILE="./brownie-ns-list.tmp.json"

kubectl get ns -l "${K8S_NAMESPACE}.tree.hnc.x-k8s.io/depth=1" -ojson | jq '.items' > $LOG_FILE

node dist/src/k8ns/index.js --dry-run $DRY_RUN --ns-file $LOG_FILE --retention-period $BROWNIE_TIMEOUT