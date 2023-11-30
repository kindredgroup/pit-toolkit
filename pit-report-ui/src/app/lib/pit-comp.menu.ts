import { Component } from "@angular/core"
import { MenuState } from "./menu"

@Component({ templateUrl: "./pit-comp.menu.html", selector: "pitc-menu" })
export class PitCompMenu {
  constructor(readonly menu: MenuState) {}
}