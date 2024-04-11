#!/bin/bash

K8S_NAMESPACE=$1

kubectl get ns -l "${K8S_NAMESPACE}.tree.hnc.x-k8s.io/depth=1" -ojson | jq '.items' > /tmp/ns-list.json

node dist/src/k8ns/index.js /tmp/ns-list.json 1minute