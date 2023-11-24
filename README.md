# Tools for deploying and executing Performance and Integration Tests

## PIT Concept

The process starts when GIT event, such as merge or push, is picked up by project pipeline. This may be coded as Jenkins pipeline or as GitHub Actions workflow.

It is expected that pipeline will checkout PIT project from well-known location or alternatively, tools provided by PIT Toolkit may be pre-installed into pipeline image.

PIT will locate specification file `pitfile.yml` in the repository which triggered the pipeline.

PIT will examine the content of git event and pass it through `filters` as they are defined in the pit spec file. Filter is defined as an array of regex patterns to be applied to file names which were part of the GIT event. If some filter matches a file, then PIT will start execution of deployment process (The process is visualised in the diagram below).

The PIT spec file contains definitions of:
- Lock Manager app
- The list of test suites

PIT Toolkit has a built-in capability of deploying components into K8s namespace.

1. PIT deploys Lock Manager app.
2. PIT iterates over test suites and deploys required dependencies into K8s namespace (the graph).
3. One of graph entries is known as Test Runner App. Test Runner App is an application capable of running performance or integration tests against multiple components. To start tests PIT sends HTTP request to Test Runner Application, for example `POST /start`.

At this point we have:
- Lock Manager app is deployed in the namespace.
- The set of locks obtained by PIT.
- Graph of components deployed in the namespace.
- Test Runner App is deployed in the namespace and executing tests.

Upon deployment, Lock Manager will prepare its database. It is expected that permanent database server prepared upfront and is accessible from the namespace. This DB is permanent it survives the lifespan of temporary namespace where Lock Manager is running. The DB is used to implement exclusivity over the running tests. Multiple instances of Lock Manager may be present in the K8s cluster each sitting in its own temporary namespace. With the help of locking only one test suite will ever run at the same time unless there is no dependency between tests.

There could be multiple Test Runner Apps deployed in the namespace. These apps may be designed to test different graphs. In such setup the invocation of these multiple Test Runner apps is orchestrated by PIT and subject to locking strategy.

All tests are divided into test suites and defined in the relevant section of pitfile. Pitfile may contain a mixed definition of local and remote test suites.

_Local_ test suites are defined in the same repository as pitfile.
_Remote_ test suites are defined as reference to remote pitfile. In this case PIT will download the file from remote repository and use its "testSuites" section.


Once Test Runner App finishes executing the test report is available via dedicated endpoint, for example via `GET /reports/{$execution_id}`

Test reports are stored permanently. Multiple reports which are obtained from different Test Runner Apps but produced in the same test session may be stitched together before storing.

The responsibilities of all mentioned components are defined as:


**Pipeline**

- Checks out PIT app and launches it

**PIT Toolkit**

- Parses `pitfile.yml`
- Executes main PIT logic described above
- Creates K8s namepsace
- Deploys Lock Manager
- Deploys Test Runner App
- Deploys graph
- Collects test report and stores it permanently
- Cleans up namespace

**Lock Manager**

- Exposes HTTP API for locks management

**Test Runner App**

- Accepts "start" signal to begin test execution
- Runs tests
- Exposes test report via HTTP

**The YAML specification (pitfile)**

- Controls whether PIT should run at all based on optional filters
- Encapsulates the location of graph within each test suite
- Defines what to do with test report

![](./docs/arch.png)


## Example of specification YAML

```YAML
version: "1.0"

trigger:
  description: Runs only if Rust source code changed in packages impacting Talos Certifier
  name: Detect Talos Certifier changes
  filter:
    expressions:
      - "packages/talos_certifier/.*"
      - "packages/talos_suffix/.*"
      - "packages/talos_certifier_adapters/.*"
      - "packages/talos_common_utils/.*"
      - "packages/talos_rdkafka_utils/.*"
      - "packages/cohort_sdk/.*"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# The Lock Manager is independent shipped as part of PIT toolkit.
# The optional "lockManager" section below will be automatically generated by PIT toolkit
# and added to every pitfile in runtime. If app does not need locking
# then section be removed.
# Here is an example of fully defined lock manager section:
#
# lockManager:
#   name: Lock Manager
#   id: lock-manager
#   location:
#     type: LOCAL
#   deploy:
#     timeoutSeconds: 60 # Optional. Defaults to 60 sec
#     command: deployment/pit/deploy.sh
#     # PIT has no knowledge how to check whether deployment went well
#     # When using helm for deployment, even if deployment of chart was successful
#     # there could be problems creating pods and getting them into healthy state. App developer is encouraged
#     # to implement more thorough checking rather than just "helm -n <NS> list | grep ...".
#     statusCheck:
#       timeoutSeconds: 60 # Optional. Defaults to 60 sec
#       command: deployment/pit/is-deployment-ready.sh
lockManager:
  enabled: true
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

testSuites:
  # - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  - name: Testset for standalone Talos Certifier
    id: testset-talos-certifier-default
    location:
      type: LOCAL # Optional. Defaults to 'LOCAL' - the definition is taken from this file

    lock:
      timeout: 1h
      ids: [ lock-talos-certifier ]

    trigger: # This is optional, when not defined, test will trigger when top level trigger goes off
    deployment:
      graph:
        testApp:
          componentName: Talos Certifier Test App
          location:
            type: LOCAL # optional, defautls to 'LOCAL'
          deploy:
            command: deployment/talos-certifier-test-app/pit/deploy.sh
            params: # Optional command line parameters
              - param1
              - param2
            statusCheck:
              command: deployment/talos-certifier-test-app/pit/is-deployment-ready.sh

        components:
          - componentName: Talos Certifier"
            # Lets assume that pipeline fired as a result of push into Talos Certifier project
            location:
              type: LOCAL
            deploy:
              command: deployment/talos-certifier/pit/deploy.sh
              statusCheck:
                command: deployment/talos-certifier/pit/is-deployment-ready.sh

          - componentName: Talos Replicator
            # Lets assume Talos Certifier and Replicator (made for testing Talos Certifier) are in the same repository
            location:
              type: LOCAL
            deploy:
              command: deployment/talos-replicator/pit/deploy.sh
              statusCheck:
                command: deployment/talos-replicator/pit/is-deployment-ready.sh

          - componentName: Some Other Component
            # This is an example how to define the remote component
            location:
              type: REMOTE
              gitRepository: git://127.0.0.1/some-other-component.git
              gitRef: # Optional, defaults to "refs/remotes/origin/master"
            deploy:
              command: deployment/pit/deploy.sh

  # - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  - name: Testset for Talos Certifier integrated with Messenger
    id: testset-talos-certifier-and-messenger
    location:
      type: REMOTE
      gitRepository: git://127.0.0.1/talos-perf-tests.git
      gitRef: ${{ env.GIT_REF_TALOS_PERF_TESTS }} # Optional. Defaults to "refs/remotes/origin/master"
      pitFile: 'pitfile.yml' # Optional, defaults to "pitfile.yml" in the project root
    # This will:
    # 1) Read pitfile from specified remote repository,
    # 2) Select subsection of file from "testSuites" node where entries are matching IDs.
    #    For example, "SELECT * FROM remote/pitfile.yml#testSuites WHERE id IN(testSuiteIds)"
    # Optional, when not defined, all when defined as empty array then all tests are included.
    testSuiteIds: [ 'testset-talos-certifier-and-messenger' ]
```

# Project Layout

| Directory | Description |
|-----------|-------------|
| `scripts/` | The scripts used during development of PIT toolkit |
| `lock-manager/` | The lock management application |
| `lock-manager/deployment/helm` | The deployment configs for K8s |
| `lock-manager/deployment/pit` | The deployment logic |
| `k8s-deployer/` | The deployment utility for apps designed to run in K8s clusters |
| `k8s-deployer/tmp` | Temporary directory which is used when running local deployer during development |
| `examples/node-1/` | The example of application integrated with PIT |
| `examples/node-1/deployment/helm` | The deployment configs for K8s |
| `examples/node-1/deployment/pit` | The deployment logic |
| `examples/node-1/pit-test-app/` | The example PIT Test Appliction for component named 'graph-node-1' |
| `examples/node-1/pit-test-app/deployment/helm` | The deployment configs for K8s |
| `examples/node-1/pit-test-app/deployment/pit` | The deployment logic |
| `examples/graph-perf-test-app/` | The example of project where more complex tests are defined in their own pitfile. |
| `examples/graph-perf-test-app/deployment/helm` | The deployment configs for K8s |
| `examples/graph-perf-test-app/deployment/pit` | The deployment logic |

# Local development

## Preprequisites:

- Docker is installed and available globally as `docker`
- Helm is installed and available globally as `helm`
- Kubectl is installed and available globally as `kubectl`
- Local K8s cluster is setup
- There is namespace "dev" or any other matching variable .env/K8S_NAMESPACE
- RSync is installed and available globally as `rsync`
- Node 16.13.2 (or compatible) is installed
- Git is installed and available globally as `git`
- HNC Manager is installed in your local kuberentes. [We need version 0.9.0](https://github.com/kubernetes-sigs/hierarchical-namespaces/releases/tag/v0.9.0)
  - Versions 1.0.0 and 1.1.0 are faulty and will not work properly on Mac.
  - Install is easy: `HNC_VERSION=v0.9.0 kubectl apply -f https://github.com/kubernetes-sigs/hierarchical-namespaces/releases/download/${HNC_VERSION}/hnc-manager.yaml`
- Kubectl plugin named "kubectl-hns" version 0.9.0 is installed on your system.
  - Installing via kubectl plugin named "krew" is not a good idea as it will pull the latest version which might not work. Hense, [install kubectl-hns v0.9.0 plugin via this link](https://github.com/kubernetes-sigs/hierarchical-namespaces/releases/tag/v0.9.0) following "Manual steps"
    - `HNC_VERSION=v0.9.0 HNC_PLATFORM=darwin_amd64 curl -L https://github.com/kubernetes-sigs/hierarchical-namespaces/releases/download/${HNC_VERSION}/kubectl-hns_${HNC_PLATFORM} -o ./kubectl-hns && chmod +x ./kubectl-hns`
- Ingress Controller named kubernetes-ingress
  - All your namespaces are being observed by HNC system. When installing NGINX ingress controller it will create its own namespace and HNC system will complain. TO prevent that we need to exclude namespace used by NGINC insgress controller from HNC.
  - Use inline editing method: `kubectl edit -n hnc-system deploy hnc-controller-manager` find deployment with name "name: hnc-controller-manager" and add one more entry into the list under `spec/containers/args`. Entry looks like this: `--excluded-namespace=ingress-nginx`
- The port 80 is free. Port 80 is used by ingress controller in your local desktop-docker.

## Build docker images

### Image for Lock Manager

```bash
cd lock-manager/

# Make sure there is lock-manager/.env with the following variables:
# - REGISTRY_URL=ksp
# - IMAGE_TAG= # can be any value or script reading current commit-sha: IMAGE_TAG=$(git rev-parse --short HEAD)
npm run dev-build-image
```

### Image for Node-1 sample component

```bash
cd examples/node-1/

# Make sure there is examples/node-1/.env with the following variables
# - K8S_NAMESPACE=dev
# - REGISTRY_URL=ksp
# - IMAGE_TAG= # can be any value or script reading current commit-sha: IMAGE_TAG=$(git rev-parse --short HEAD)
# - SERVICE_NAME=node-1
# - SERVICE_PORT=62001
# - TEST_APP_SERVICE_NAME=node-1-test-app
# - TEST_APP_SERVICE_PORT=62002
npm run dev-build-image
```

### Image for example Test application targetting Node-1 sample component

```bash
cd examples/node-1/pit-test-app

# .env file is used from the parent directory (node-1)
npm run dev-build-image
```
### Image for standalone example Test application targetting Node-1 sample component

```bash
cd examples/graph-perf-test-app

# Make sure there is examples/graph-perf-test-app/.env with the following variables
# - K8S_NAMESPACE=dev
# - REGISTRY_URL=ksp
# - SERVICE_NAME=graph-perf-test-app
# - SERVICE_PORT=32003
# - IMAGE_TAG= # can be any value or script reading current commit-sha: IMAGE_TAG=$(git rev-parse --short HEAD)
# The internal port of node-1 app.
# Must match the value used in "node1/.env" and "node1/deployment/helm#service.port"
# - TARGET_SERVICE_PORT=62001
npm run dev-build-image
```

# Deploy to k8s
## Manually deploy to local kubernetes cluster under "dev" namespace

```bash
cd pit-toolkit/

# Deploying Lock manager

# Make sure there is lock-manager/.env file with the following variables:
# - K8S_NAMESPACE=dev
# - REGISTRY_URL=ksp
# - IMAGE_TAG=$(git rev-parse --short HEAD)
# - SERVICE_NAME=lock-manager
# - SERVICE_PORT=60001
make deploy.lock-manager

# Deploying node-1 and node-1-test-app

# Make sure there is examples/node-1/.env file with the following variables:
# - K8S_NAMESPACE=dev
# - REGISTRY_URL=ksp
# - IMAGE_TAG=$(git rev-parse --short HEAD)
# - SERVICE_NAME=node-1
# - SERVICE_PORT=62001
# - TEST_APP_SERVICE_NAME=node-1-test-app
# - TEST_APP_SERVICE_PORT=62002

make deploy.node-1
make deploy.node-1-test-app

# check
helm -n dev list
kubectl -n dev get pods
```
## Deploy to local kubernetes using k8s-deployer app

This is main approach intented to be used on CIs. For example, when we need to trigger tests on commit into some project integrated with PIT there will be some pipeline implemented on CI which will start executing as a result of push commit into GIT repo.

It is expected that CI will check out project into some temporary directory and launch k8s-deployer app. Below are instructions how to simluate this scenario locally.

```bash
cd pit-toolkit/k8s-deploy

# Make sure there are docker images in your local registry:
# - ksp/lock-manager:<tag>
# - ksp/node-1:<tag>
# - ksp/node-1-test-app:<tag>
# where <tag> is value from .env/IMAGE_TAG of the corresponding project.

mkdir ./tmp

# Parameters:
#   1: Temporary directory which will be used by k8s-deployer
#   2: Path to application under test. This is application whose pitfile will be processed.
#      It is expected that there is "pitfile.yml" at the root of the project,
#      such as "$(pwd)/examples/node-1/pitfile.yml".
npm run dev.start-example $(pwd)/tmp $(pwd)/examples/node-1

```

### Development with local git server

When testing deployments where some "location" sections of pitfile.yml require sources checkout from GIT,
we can still develop with running git server locally.

For example, lets assume that "node-1" component of our graph has to be checked out from remote location.
We have this project locally on our machine under "examples/node-1".

Lets expose in local git server on port 60100 (the default)

```bash
# create directory outside of current git project
mkdir /tmp/remote-sample

# Run git server for node-1 project
scripts/host-project-in-git.sh /tmp/remote-sample $(pwd)/examples/node-1

Using default port: 60100
PROJECT_DIR=~/kindred/projects/pit-toolkit/examples/node-1
WORKSPACE=/tmp/remote-sample
PORT=60100
GIT_SERVER_HOME=/tmp/remote-sample/git-server
TMP_PATH=/tmp/remote-sample/git-server/node-1.git/tmp
hint: Using 'master' as the name for the initial branch. This default branch name
hint: is subject to change. To configure the initial branch name to use in all
hint: of your new repositories, which will suppress this warning, call:
hint:
hint: 	git config --global init.defaultBranch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
Initialized empty Git repository in /tmp/remote-sample/git-server/node-1.git/tmp/.git/
Switched to a new branch 'master'

Launching git server. Checkout your project from git://127.0.0.1:60100/node-1.git
```

Similarly run gir server for "remote test app"
```bash
scripts/host-project-in-git.sh /tmp/remote-sample $(pwd)/examples/graph-perf-test-app
```
