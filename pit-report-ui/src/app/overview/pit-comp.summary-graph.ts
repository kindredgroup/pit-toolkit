import { Component, Input } from "@angular/core"
import { Report } from "../report-service"

@Component({ templateUrl: "./pit-comp.summary-graph.html", selector: "pitc-summary-graph" })
export class PitCompSummaryGraph {
  @Input() report: Report | undefined
}