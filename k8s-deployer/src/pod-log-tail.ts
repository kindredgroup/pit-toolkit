import { logger } from "./logger.js"
import * as NodeShell from "node:child_process"
import * as fs from "node:fs"
import { Namespace } from "./model.js"

export class PodLogTail {

  private tailer?: NodeShell.ChildProcess

  constructor(
    readonly namespace: Namespace,
    readonly service: string,
    readonly logFilePath: string) {
  }

  start(): PodLogTail {
    if (this.tailer) throw new Error(`Tailer is already attached to process with PID: ${this.tailer.pid}`)

    // creating streams
    const out = fs.openSync(this.logFilePath, 'a')
    const err = fs.openSync(this.logFilePath, 'a')

    this.tailer = NodeShell.spawn(
      "k8s-deployer/scripts/tail-container-log.sh",
      [ this.namespace, this.service ],
      {
        detached: true,
        stdio: [ 'ignore', out, err ]
      }
    )

    logger.info("PodLogTail.start(): Log tailer started with PID: %s. The content is being written to: %s", this.tailer.pid, this.logFilePath)
    return this
  }

  stop(): boolean {
    if (!this.tailer) {
      throw new Error("Tailer is not attached to any process")
    }

    const pid = this.tailer.pid
    const wasStopped = this.tailer.kill("SIGKILL")
    if (wasStopped) {
      logger.info("PodLogTail.stop(): The log tailer with PID %s has been stopped", pid)
    } else {
      logger.warn("PodLogTail.stop(): Unable to stop the log tailer with PID %s. Has it  been stopped already?", pid)
    }

    return wasStopped
  }
}

