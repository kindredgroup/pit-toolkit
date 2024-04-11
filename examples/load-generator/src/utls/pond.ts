// A double-ended queue implemented with a growable ring buffer.
class ArrayDeque {
  private items: Array<any>
  private nextRead: number = 0
  private size: number = 0

  constructor(private initialCapacity: number) {
    this.items = new Array(initialCapacity)
  }

  addLast(item: any) {
    this.ensureCapacity(this.size + 1)
    this.items[(this.nextRead + this.size) % this.items.length] = item
    this.size += 1
  }

  ensureCapacity(requiredCapacity: number) {
    if (this.items.length < requiredCapacity) {
      let newItems = new Array(requiredCapacity * 2)
      for (let i = 0; i < this.size; i++) {
        newItems[i] = this.items[(this.nextRead + i) % this.items.length]
      }
      this.nextRead = 0
      this.items = newItems
    }
  }

  removeFirst(): any {
    if (this.size == 0) {
      return undefined
    } else {
      let nextItem = this.items[this.nextRead]
      this.nextRead = (this.nextRead + 1) % this.items.length
      this.size -= 1
      return nextItem
    }
  }
}

export class Pond {
  private backlog: ArrayDeque
  private live: number = 0
  private drainer: any = null

  constructor(private concurrencyFactor: number) {
    this.backlog = new ArrayDeque(concurrencyFactor * 16)
  }

  // Submits a new async task for execution. The task is a parameterless function returning a promise.
  submit(task: any) {
    if (this.live < this.concurrencyFactor) {
      this.live++
      new Promise<void>(async resolve => {
        await task()

        while (true) {
          let backlogged = this.backlog.removeFirst()
          if (backlogged === undefined) {
            this.live--
            if (this.live == 0 && this.drainer !== null) {
              let drainer = this.drainer
              this.drainer = null
              drainer()
            }
            break
          } else {
            await backlogged()
          }
        }
        resolve()
      })
    } else {
      this.backlog.addLast(task)
    }
  }

  // Drains the work queue, returning a promise fulfilled when the queue is emptied.
  drain(): any {
    if (this.live == 0) {
      return Promise.resolve()
    } else {
      return new Promise(resolve => {
        this.drainer = resolve
      })
    }
  }
}