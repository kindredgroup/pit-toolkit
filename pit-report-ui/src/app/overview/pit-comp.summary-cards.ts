import { Component, Input } from "@angular/core"
import { Report } from "../report-service"

@Component({ templateUrl: "./pit-comp.summary-cards.html", selector: "pitc-summary-cards" })
export class PitCompSummaryCards {
  @Input() report: Report | undefined

  formatDuration(): string {
    if (!this.report) return ''
    const duration = this.report.duration
    if (duration === 0) return "00:00:00.000"

    const pad = (v: number, count: number): string => {
      let result= `${v}`
      while (result.length < count) {
        result = `0${result}`
      }
      return result
    }

    const S = 1_000
    const M = S * 60
    const H = M * 60

    let hours = 0
    let minutes = 0
    let seconds = 0
    let millis = 0
    let reminder = duration
    hours = Math.floor(reminder / H)
    reminder -= hours * H
    if (reminder === 0) return `${ hours }h ${ minutes }m ${ seconds }.${ millis }s`

    minutes = Math.floor(reminder / M)
    reminder -= minutes * M
    if (reminder === 0) return `${ hours }h ${ minutes }m ${ seconds }.${ millis }s`

    seconds = Math.floor(reminder / S)
    reminder -= seconds * S
    if (reminder === 0) return `${ hours }h ${ minutes }m ${ seconds }.${ millis }s`

    millis = reminder
    return `${ hours }h ${ minutes }m ${ seconds }.${ millis }s`
  }
}