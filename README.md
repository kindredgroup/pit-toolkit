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
| Pipeline | Checks out PIT Toolkit and invokes PUT script
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
devptfileVersion: 1.0

trigger:
  description: Runs only if Rust source code changed in packages impacting Talos Certifier
  filters:
    - name: Detect Talos Certifier changes
      expressions: 
        - "packages/talos_certifier/.*"
        - "packages/talos_suffix/.*"
        - "packages/talos_certifier_adapters/.*"
        - "packages/talos_common_utils/.*"
        - "packages/talos_rdkafka_utils/.*"

deployment:
  # The location of Sitrus. This will be used for deploying the graph to namespace.
  sitrus:
    gitRepository: git@github.com/.../sitrus.git
    gitRef: ${{ env.SITRUS_BRANCH }}

  # The reference to test bundle. Sitrus will deploy this app to the namespace before deploying
  # a graph. This app will contain test runner along with self-contained tests.
  testApp:
    gitRepository: git@github.com/.../pit-runner.git
    gitRef: ${{ env.PIT_RUNNER_VERSION }}
    # The path to directory containin artefacts required by Sitrus deployment protocol
    sitrusPath: ./deployment/sitrus
    # Describes where to checkout test soruces from. May sit in the same project repository as this file or
    # hosted separately.
    testSources:
        gitRepository: git@github.com/.../talos-certifier.git
        gitRef: ${{ env.TALOS_CERTIFIER_BRANCH }}
        checkoutPath: tests/devpt

  # The list of apps/components which must be deployed. This section will be used to generate 
  # the deployment instructions for Sitrus. Every entry in the list of independent component 
  # which should be deployed to namespace.
  graph:
    - componentName: "Talos Certifier"
      gitRepository: git@github.com/.../talos-certifier.git
      gitRef: ${{ env.TALOS_CERTIFIER_BRANCH }}
      # The path to directory containin artefacts required by Sitrus deployment protocol
      sitrusPath: ./deployment/sitrus
```