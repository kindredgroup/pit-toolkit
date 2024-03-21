# Why PIT needs a Cleanup process?
In case of successful completion of the graph run, test components should release all the resources at graceful shutdown and the K8-deployer should free all the locked resources for PIT toolkit. But in case of a crash the resources are left abandoned, creating a need for a method to do the cleanup and free the abandoned resources.


# When to start Clean up action
1. Once the tests are complete - The test-runner app will release the locks, and K8 deployer will run un-deploy apps and delete namespaces
2. CD pipeline failure - 
    - K8-deployer 
    - Graph deployment
    - Test Run failure
3. In case of silent failure of the Test Component, getting to a state of coma. It exists but is not executing tests; it is hard to detect this failure. Can keep a tab on the number of restarts of the component pods
4. When there is an environment exception Eg Jenkins crash

As 3,4 all need to remove resources to be cleaned, it would be ideal to have a run outside the deployer as a monitor/fail-detector job.

### PIT stray resources are
- Locks
- Namespaces -  force delete including all the apps within that namespace

## Removing the PIT stray resources
    - `Cleanup process` POD is deployed under the DPT 
    - It is scheduled to run each night(configurable)


### Environemnt Cleanup proposal 
Resources created by Test components are not in PIT control
- Databases 
- Kafka Topics
- Namespaces
- Lock-manager stale entries
As PIT will not be aware of the test component's blocked resources, thus the cleanup for Databases and Kafka topics will be done in a seaparate function. 
The names to the DB used by the Test Components should depict their usage for PIT thus prefixed as `pit-${db_name}`, similarly kafka topic names prefixed as `pit-${kafka_topic}` making it evident for `environment cleanup` on what resources to be cleaned. The namespaces still left after the `pit-cleanup`s run would be under the parent namespace or `dpt` or something on the line `dpt` and can be picked by the `age` of a namespace being alive. In usual PIT tests should run for at max a day(understanding may change as the system matures), also giving a grace time over the 24 hrs for picking the resources to be cleaned by the `environmental cleanup`. Process will either be manual or run at a set frequecy not very vigrous ( once a week or maybe even once every month). 





