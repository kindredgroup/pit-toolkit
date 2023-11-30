import { Component, OnInit } from "@angular/core"
import { MenuState } from "../lib/menu"
import { Report, ReportService } from "../report-service"

@Component({ templateUrl: "./page.overview.html" })
export class PageOverview implements OnInit {
  report: Report
  constructor(readonly menu: MenuState, readonly reportService: ReportService) {
    this.report = this.reportService.getReport()
  }

  ngOnInit(): void {
    this.menu.select("overview")
  }

}