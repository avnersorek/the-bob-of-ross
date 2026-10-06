import type { EventBus } from "../core/state/eventBus";

export interface ControlBarHandlers {
  onClear(): void;
  onSave(): void;
  onToggleSync(): void;
  onToggleAudio(): void;
  onTogglePauseAtEnd(): void;
}

export class ControlBar {
  private element: HTMLDivElement;
  private syncBtn!: HTMLButtonElement;
  private audioBtn!: HTMLButtonElement;
  private pauseAtEndBtn!: HTMLButtonElement;

  constructor(_container: HTMLElement, bus: EventBus, handlers: ControlBarHandlers) {
    this.element = document.getElementById("control-bar") as HTMLDivElement;
    this.render(handlers);
    bus.on("sync:toggle", ({ enabled }) => {
      this.syncBtn.textContent = `Sync: ${enabled ? "On" : "Off"}`;
      this.syncBtn.setAttribute("aria-pressed", String(enabled));
    });
    bus.on("audio:toggle", ({ muted }) => {
      this.audioBtn.textContent = `Audio: ${muted ? "Muted" : "On"}`;
      this.audioBtn.setAttribute("aria-pressed", String(!muted));
    });
    bus.on("toolend:toggle", ({ enabled }) => {
      this.pauseAtEndBtn.textContent = `Pause at tool end: ${enabled ? "On" : "Off"}`;
      this.pauseAtEndBtn.setAttribute("aria-pressed", String(enabled));
    });
  }

  private render(handlers: ControlBarHandlers): void {
    this.element.innerHTML = `
      <button id="clear" type="button">Clear canvas</button>
      <button id="save" type="button">Save PNG</button>
      <button id="toggle-sync" type="button" aria-pressed="true">Sync: On</button>
      <button id="toggle-audio" type="button" aria-pressed="true">Audio: On</button>
      <button id="toggle-pause-end" type="button" aria-pressed="true">Pause at tool end: On</button>
    `;
    this.element
      .querySelector<HTMLButtonElement>("#clear")!
      .addEventListener("click", handlers.onClear);
    this.element
      .querySelector<HTMLButtonElement>("#save")!
      .addEventListener("click", handlers.onSave);
    this.syncBtn = this.element.querySelector<HTMLButtonElement>("#toggle-sync")!;
    this.audioBtn = this.element.querySelector<HTMLButtonElement>("#toggle-audio")!;
    this.pauseAtEndBtn = this.element.querySelector<HTMLButtonElement>("#toggle-pause-end")!;
    this.syncBtn.addEventListener("click", handlers.onToggleSync);
    this.audioBtn.addEventListener("click", handlers.onToggleAudio);
    this.pauseAtEndBtn.addEventListener("click", handlers.onTogglePauseAtEnd);
  }
}
