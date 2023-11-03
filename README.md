# Tools for deploying and executing Performance and Integration Tests

## PIT Concept

The process starts when GIT event, such as merge or push, is picked up by project pipeline. This may be coded as Jenkins pipeline or as GitHub Actions workflow.

It is expected that pipeline will checkout PIT project from well-known location or alternatively, tools provided by PIT Toolkit may be pre-installed into pipeline image.

PIT will locate `pitfile.yml` specification file in the repository which triggered the pipeline.

PIT will examine the content of git event and pass it through `filters` as they are defined in the pit spec file. Filter is defined as an array of regex patterns to be applied to file names which were part of the GIT event. If some filter matches a file, then PIT will start execution of deployment process.

The process is visualised in the diagram below.

The PIT spec file contains the deployment section consisting of the following:
- The definition of Sitrus project
- The definition of PIT Test Runner Application
- The definition of "Graph". The graph here is a set of applications which must be deployed into environment for testing purposes.

PIT will check out Sitrus project, then read definition of graph and feed that graph to Sitrus. This marks the beginning of the deployment.

With the help of Sitrus the PIT will prepare the deployment of PIT Test Runner Application and graph of apps under test. Tests sources will be included into PIT Test Runner App image.

Sitrus, as independent utility, will checkout all projects listed in the graph, and deploy them into new namespaces in some target environment. It may be environment for long running performance tests or environment for integration tests. PIT tool does not make assumptions what environment will be targeted, if it is described in the spec file.

Once Sitrus is done with deployments the control is passed back to the PIT process.

At this point we have:
- Graph running in the environment
- PIT Test Runner Application running in the environment
    - Test sources are included in the PIT Test Runner Application container
- PIT Test Runner Application listens to incoming HTTP requests.

PIT sends HTTP request to PIT Test Runner Application `POST /start`. This marks as the beginning of test execution.

Application responds immediately. A simple 200 response means that request has been scheduled.

Upon deployment, PIT Test Runner Application will prepare its database. It is expected that permanent database server prepared upfront and is accessible from the environment. This DB is permanent it survives the lifespan of temporary namespace where PIT Test Runner Application is running. The DB is used to implement exclusivity over the running tests. Multiple instances of Test Runner App may be present in the k8s cluster each sitting in their own temporary namespace. With the help of locking only one instance will start executing its tests.

Once test execution is done the test report is available via dedicated endpoint, for example via `GET /reports/{$execution_id}`

Once report is downloaded and analysed by PIT toolkit then it may be permanently stored in one of:
- The Project Repository
- The repository where project tests are kept
- The dedicated repository for tests reports

The responsibility of the components are defined as:

| Component | Description |
| ----------| --------------------------------------------- |
| Pipeline | Checks out PIT Toolkit and invokes PIT script
| PIT Toolkit | Provides tools for parsing `pitfile.yml` |
| PIT Toolkit | Executes main PIT logic described above |
| PIT Toolkit | Prepares PIT Test Runner Application with test sources |
| PIT Toolkit | Collects test report and stores it permanently |
| Sitrus | Creates namespace, deploys, un-deploys graph and PIT Test Runner Application |
| PIT Test Runner Application | Accepts "start" signal to schedule test |
| PIT Test Runner Application | Deals with ordering of tests, implements locking logic |
| PIT Test Runner Application | Runs tests |
| PIT Test Runner Application | Exposes test report via HTTP |
| `pitfile.yml` | Controls whether PIT should run at all based on optional filters |
| `pitfile.yml` | Encapsulates the location of graph, Sitrus and project tests. Any compatible version/branch can be used. |
| `pitfile.yml` | Defines what to do with test report |


![](./docs/arch.png)




## Example of specification YAML

<em>(This is not complete yet)</em>

```YAML
projectName: Talos Certifier
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
# - Lock-Manager is independent node app. Sources are hosted in pit-toolkit repo.
# - The new re-defined Sitrus is also node app. Sources are hosted in the same pit-toolkit repo.
# Given two points above it is enough to have a single fetch step for obtaining Lock Manager and "new Sitrus"
# When it comes to deploying Lock Manager, Sitrus need to be given a location of script
# through which to kick start the deployment. See "deploymentLauncher".
lockManager:
  description: Defines the Lock manager application
  location:
    gitRepository: git://127.0.0.1/pit-toolkit.git
    gitRef: ${{ env.PIT_TOOLKIT_BRANCH }}
  deploymentLauncher: deployment/pit/lock-manager/deploy.sh
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

testSuites:
  # - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  - name: Testset for standalone Talos Certifier
    id: testset-talos-certifier-default
    location.type: LOCAL # Optional. Defaults to 'LOCAL' - the definition is taken from this file

    lock:
      timeout: 1h
      ids: [ lock-talos-certifier ]

    trigger: # This is optional, when not defined, test will trigger when top level trigger goes off
    deployment:
      graph:
        - componentName: Talos Certifier Test App
          location:
            type: LOCAL # optional, defautls to 'LOCAL'
          deploymentLauncher: deployment/pit/talos-certifier-test-app/deploy.sh

        - componentName: Talos Certifier"
          location:
            # Lets assume that pipeline fired as a result of push into Talos Certifier project
            type: LOCAL
          deploymentLauncher: deployment/pit/talos-certifier/deploy.sh

        - componentName: Talos Replicator"
          location:
            # Lets assume Talos Certifier and Replicator (made for testing Talos Certifier) are in the same repository
            type: LOCAL
          deploymentLauncher: deployment/pit/talos-replicator/deploy.sh
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
    testSuiteIds: [ 'testset-talos-certifier-and-messenger' ]
```