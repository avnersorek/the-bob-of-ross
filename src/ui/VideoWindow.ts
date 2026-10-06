import type { EventBus } from "../core/state/eventBus";
import { makeDraggable } from "./drag";

export class VideoWindow {
  private element: HTMLDivElement;
  private container: HTMLDivElement;
  private header: HTMLDivElement;

  constructor(_container: HTMLElement, _bus: EventBus) {
    this.element = document.getElementById("video-window") as HTMLDivElement;
    this.container = document.getElementById("video-container") as HTMLDivElement;
    this.header = document.getElementById("video-header") as HTMLDivElement;
    makeDraggable(this.element, this.header);
  }

  setContainerId(id: string): void {
    this.container.id = id;
  }

  setTitle(title: string): void {
    this.header.textContent = title;
    this.header.title = title;
  }

  show(): void {
    this.element.classList.remove("hidden");
  }
}
