import { Injectable } from "@angular/core"
import PitReport from "./pit-report.json"

export class Scenario {
  name: string
  startTime: Date
  endTime: Date
  components: Array<any>
  streams: Array<any>

  constructor(readonly rawData: any) {
    this.name = rawData.name
    this.endTime = new Date(Date.parse(rawData.endTime))
    this.startTime = new Date(Date.parse(rawData.startTime))
    this.components = this.rawData.components.map((v:any) => {return {...v}})
    this.streams = this.rawData.streams.map((v:any) => {return {...v}})
  }
}

export class Report {
  scenariosCount: number
  scenarios: Array<Scenario>
  duration: number
  startTime: Date
  endTime: Date
  streams: any = { failed: 0, passed: 0}
  components: Array<any> = []

  constructor(readonly rawData: any) {
    this.scenariosCount = this.rawData.scenarios?.length || 0
    this.scenarios = this.rawData.scenarios.map((s:any) => new Scenario(s))
    this.startTime = new Date(Date.parse(rawData.startTime))
    this.endTime = new Date(Date.parse(rawData.endTime))
    this.duration = (this.endTime.getTime() - this.startTime.getTime())
    this.scenarios.forEach(s => {
      s.components.forEach((c: any) => {
        const existing = this.components.find(i => i.name === c.name)
        if (existing) {
          existing.scenarios.push(s.name)
        } else {
          this.components.push({...c, scenarios: [ s.name ]})
        }
      })

      s.streams.forEach((stream: any) => {
        if (stream.outcome === "PASS") this.streams.passed++
        if (stream.outcome === "FAIL") this.streams.failed++
      })
    })
  }
}

@Injectable({providedIn: "root"})
export class ReportService {
  report: Report
  constructor() {
    this.report = new Report((window as any).REPORT)
    // this.report = new Report(PitReport)
  }

  getReport(): Report { return this.report }
}