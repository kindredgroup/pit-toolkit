import { Component, OnInit } from '@angular/core'
import { Router, RoutesRecognized } from '@angular/router'
import { Report, ReportService } from './report-service'

@Component({ templateUrl: "./app.component.html", selector: "app-root", styleUrl: "./app.component.css" })
export class AppComponent implements OnInit {
  report: Report
  constructor(private router: Router, private reportService: ReportService) {
    this.report = this.reportService.getReport()
  }

  ngOnInit() {
    this.router.events.subscribe((data) => {
      if (data instanceof RoutesRecognized) {
        // init variables
      }
    })
  }
}
