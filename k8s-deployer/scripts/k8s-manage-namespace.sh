#!/bin/bash

STATUS_DONE="Status=DONE"
STATUS_ERROR="Status=ERROR"

k=$(which kubectl)
if [ "${k}" == "" ]
then
  echo "Executable 'kubectl' cannot be found."
  echo "$STATUS_ERROR"
  exit 1
fi

PARENT_NS=$1
ACTION=$2
NS=$3
TIMEOUT_SECONDS=$4

if [ "${PARENT_NS}" == "" ];
then
  echo """
Missing parent namespace. Usage:
  ${0} 'my-parent-namespace' <action> 'my-namespace'"""
  exit 1
fi

parentNsStatus=$(kubectl get namespace ${PARENT_NS} -o json | jq -r '.status.phase')
if [ "${parentNsStatus}" != "Active" ];
then
  echo """
Unable to use namespace '${PARENT_NS}' with status: '${parentNsStatus}'
Run this for more details: 'kubectl get namespace ${PARENT_NS} -o json'
"""
  exit 1
fi

if [ "${ACTION}" != "create" ];
then
  if [ "${ACTION}" != "delete" ];
  then
    echo """
Missing or unknown action paramter. Action can be 'create' or 'delete'. Usage:
  ${0} 'my-parent-namespace' create 'my-namespace'
  or
  ${0} 'my-parent-namespace' delete 'my-namespace'
  """
    exit 1
  fi
fi

if [ "${NS}" == "" ];
then
  echo """
Missing namespace paramter. Usage:
  ${0} 'my-parent-namespace' create 'my-namespace'
  or
  ${0} 'my-parent-namespace' delete 'my-namespace'
  """
  exit 1
fi

if [ "${ACTION}" == "create" ];
then
  existsAlready=$(kubectl get ns ${NS} --ignore-not-found)
  if [ "${existsAlready}" == "" ];
  then
    echo "Creating namespace: ${NS} under parent ${PARENT_NS}, this may take some time..."
    kubectl hns create $NS -n $PARENT_NS
    returnStatus=$(($?+0))

    if [ $returnStatus -ne 0 ];
    then
      exit $returnStatus
    fi

    sleepDuration=5
    totalAttempts=$(($TIMEOUT_SECONDS / $sleepDuration))
    iteration=0
    nsCreated="false"
    while [ $iteration -lt $totalAttempts ];
    do
      result=$(kubectl get ns $NS -o json --ignore-not-found | jq -r --arg parent "${PARENT_NS}" 'select(.metadata.annotations."hnc.x-k8s.io/subnamespace-of"==$parent) | .metadata.name')
      if [ "${result}" == "${NS}" ];
      then
        echo "Namespace was created, checking hierarchy tree"
        nsCreated="true"
        break # exit while loop
      fi

      sleep $sleepDuration
      iteration=$(($iteration+1))
      echo "...waiting for confirmation attempt $iteration of $totalAttempts"
    done

    if [ "${nsCreated}" != "true" ];
    then
      # This will signal to the monitor the stop event
      echo "$STATUS_ERROR"
      exit 1
    fi

    # - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    # We think that namespace was created. Lets double check that hierarchy was setup
    totalAttempts=$((($TIMEOUT_SECONDS - ($sleepDuration * $iteration)) / $sleepDuration))
    iteration=0
    nsCreated="false"
    while [ $iteration -lt $totalAttempts ];
    do
      result=$(kubectl hns tree $PARENT_NS | grep "\[s\] ${NS}")
      if [ "$result" == "└── [s] ${NS}" ];
      then
        # This will signal to the monitor the stop event
        echo "Namespace hierarchy was created ${PARENT_NS} > ${NS}"
        kubectl hns tree $PARENT_NS
        echo ""
        echo "$STATUS_DONE"
        exit 0
      fi

      sleep $sleepDuration
      iteration=$(($iteration+1))
      echo "...waiting for confirmation attempt $iteration of $totalAttempts"
    done

    if [ "${nsCreated}" != "true" ];
    then
      # This will signal to the monitor the stop event
      echo "$STATUS_ERROR"
      exit 1
    fi
    # - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  else
    echo "Namespace already exists ${NS}"
    # This will signal to the monitor the stop event
    echo "$STATUS_DONE"
    exit 0
  fi # exists
fi

if [ "${ACTION}" == "delete" ];
then
  echo "Deleting namespace ${NS} from ${PARENT_NS}, this may take some time..."
  kubectl hns set $NS --allowCascadingDeletion
  kubectl delete subns -n $PARENT_NS $NS
  kubectl hns tree $PARENT_NS

  echo "$STATUS_DONE"
  exit 0
fi