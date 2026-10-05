import type { EventBus } from "../core/state/eventBus";

export class VideoWindow {
  private element: HTMLDivElement;
  private container: HTMLDivElement;

  constructor(_container: HTMLElement, _bus: EventBus) {
    this.element = document.getElementById("video-window") as HTMLDivElement;
    this.container = document.getElementById("video-container") as HTMLDivElement;
  }

  setContainerId(id: string): void {
    this.container.id = id;
  }

  show(): void {
    this.element.classList.remove("hidden");
  }
}