# Why PIT needs a Cleanup process?
In case of successful completion of the graph run, test components should release all the resources at graceful shutdown and the K8-deployer should free all the locked resources blocked for PIT toolkit. Unfortunately, in case of a crash the resources are left unattached to any process creating a need for an extra method to do the cleanup after.


# When to start Clean up action
1. Once the tests are complete - The test-runner app will release the locks, and K8 deployer will run un-deploy apps and delete namespaces
2. Deployment failure - 
    - K8-deployer deployment failure
    - In case of an incomplete graph deploy
    - When there is a test execution exception within the test component if the exception is bubbled (right now, the locks are cleared and an exception is logged in case the status for the runner is not OK)
3. In case of silent failure of the Test Component, getting to a state of coma. It exists but is not executing tests; it is hard to detect this failure. Can keep a tab on the number of restarts of the component pods
4. When there is an environment exception Eg Jenkins crash

As 3,4 all need to remove resources to be cleaned, it would be ideal to have a run outside the deployer as a monitor/fail-detector job.

### PIT stray resources are
- Locks
- Deployed apps
- Namespaces

## Removing the PIT stray resources
Pre-requisite - Jenkins is up and running, also K8-deployer is in the deployed state. 
> TO clarify while implementing whether pit-cleanup can be called from within the working pipeline when there is a failure, or a Jenkins job is triggered 
The knowledge of all the components in the graph is available through PIT file
1. To remove locks
2. Names of all the apps 
Namespaces are present in the K8-deployer context that will need to be undeployed as a step in clean up process.


### Test component not in PIT control
- Db resources
- Topics
As PIT will not be aware of the test component's blocked resources, thus the cleanup for DB resources and Kafka topics will be done in a seaparate function.

### Options of where can the clean up scripts live
Manual clean-ups
Jenkins cron job
K8 cron job
