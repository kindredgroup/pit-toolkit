import ScyllaManager, {
    AddTaskModel,
    DbConfig,
    GetTaskModel,
    Task,
    TaskStatus,
  } from "scylla_pg_client";
  import {v4 as uuid} from "uuid";

export class ScyllaTests {
    private scyllaManager: ScyllaManager ;
    private dbConfig: DbConfig;
    constructor() {
    this.dbConfig = {
      pgHost: "localhost",
      pgPort: 5432,
      pgUser: "postgres",
      pgPassword: "postgres",
      pgDatabase: "scylla",
      pgPoolSize: 10,
    };

    }
    async instantiateScyllaManager() {
        this.scyllaManager = await ScyllaManager.initiate(this.dbConfig)
    }
    private  addTask = async () => {
        const task: AddTaskModel = {
          rn: uuid(),
          queue: "test",
          spec: {},
          priority: 1,
        };
        return await this.scyllaManager.addTask(task)
        
      };

    async completeFlow()  {
        const startTime = new Date().getTime()
        let timeElapsed = 0;
        const task: Task = await this.addTask()
        let leasedTask;
        let completedTask;
        // Right now No retries
        if(!!task?.rn) {
            leasedTask = await this.scyllaManager.leaseTask(task?.rn,'scylla-test-app')
        }
        if(!!leasedTask?.rn) {
            completedTask = await this.scyllaManager.completeTask(leasedTask?.rn)
        }
        if(!!completedTask?.rn) {
            const endTimes = new Date().getTime()
            timeElapsed = endTimes - startTime
        }
        
        return timeElapsed
    }

    async listenerFlow() {
        const startTime = new Date().getTime()
        let timeElapsed = 0;
        const task: Task = await this.addTask()
        if(!!task?.rn) {
            const endTimes = new Date().getTime()
            timeElapsed = endTimes - startTime
        }
        
        return timeElapsed
    }


    async workerFlow() {
        //TODO: Implement worker flow
        return 0
    }
}