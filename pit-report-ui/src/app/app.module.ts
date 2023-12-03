import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'

import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

import { AppComponent } from './app.component'
import { AllRoutes } from './app.routes'
import { PitCompMenu } from './lib/pit-comp.menu'
import { PitCompMenuMobile } from './lib/pit-comp.menu-mobile'
import { MenuState } from './lib/menu'
import { ReportService } from './report-service'
import { PageOverview } from './overview/page.overview'
import { PitCompSummaryCards } from './overview/pit-comp.summary-cards'
import { PitCompSummaryGraph } from './overview/pit-comp.summary-graph'
import { PitCompScenario } from './scenarios/pit-comp.scenario'
import { PageScenarios } from './scenarios/page.scenarios'

@NgModule({
  declarations: [
    AppComponent,
    PitCompMenu,
    PitCompMenuMobile,
    PitCompSummaryCards,
    PitCompSummaryGraph,
    PitCompScenario,
    PageOverview,
    PageScenarios,
  ],
  imports: [
    BrowserModule,
    AllRoutes,
    BrowserAnimationsModule
  ],
  providers: [
    MenuState,
    ReportService
  ],
  bootstrap: [ AppComponent ],
  exports: []
})
export class AppModule { }
