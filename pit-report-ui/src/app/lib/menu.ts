import { Injectable } from "@angular/core"
import { Router } from "@angular/router"
@Injectable({ providedIn: 'root' })
export class MenuState {
  selectedItem = "overview"

  constructor(readonly router: Router) {}
  isOverviewSelected(): boolean {
    return this.selectedItem === "overview"
  }
  isScenariosSelected(): boolean {
    return this.selectedItem === "scenarios"
  }
  isMetadataSelected(): boolean {
    return this.selectedItem === "metadata"
  }

  select(item: string) {
    this.selectedItem = item
  }
}


