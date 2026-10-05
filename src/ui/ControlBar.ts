import type { EventBus } from "../core/state/eventBus";

export class ControlBar {
  private element: HTMLDivElement;

  constructor(container: HTMLElement, _bus: EventBus) {
    this.element = document.createElement("div");
    container.appendChild(this.element);
  }

  render(): void {
    this.element.innerHTML = `
      <button id="clear">Clear</button>
      <button id="save">Save PNG</button>
      <button id="toggle-sync">Sync: On</button>
      <button id="toggle-audio">Audio: Unmuted</button>
    `;
  }
}