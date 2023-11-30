import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { PageOverview } from './overview/page.overview'
import { PageScenarios } from './scenarios/page.scenarios'

const routes: Routes = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  {
    path: 'overview',
    component: PageOverview,
    data: { layout: 'full' }
  },
  {
    path: 'scenarios',
    component: PageScenarios,
    data: { layout: 'full' }
  },
  { path: '**', redirectTo: 'overview', pathMatch: 'full' },
]

@NgModule({
  imports: [ RouterModule.forRoot(routes, { useHash: true }) ],
  exports: [ RouterModule ]
})
export class AllRoutes { }
