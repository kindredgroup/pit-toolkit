import { Component, Input } from "@angular/core"
import { Scenario } from "../report-service"

@Component({ templateUrl: "./pit-comp.scenario.html", selector: "pitc-scenario" })
export class PitCompScenario {
  @Input() scenario: Scenario | undefined
  json = JSON
}