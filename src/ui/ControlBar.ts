import type { EventBus } from "../core/state/eventBus";

export interface ControlBarHandlers {
  onClear(): void;
  onSave(): void;
  onToggleSync(): void;
  onToggleAudio(): void;
}

export class ControlBar {
  private element: HTMLDivElement;
  private syncBtn!: HTMLButtonElement;
  private audioBtn!: HTMLButtonElement;

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
  }

  private render(handlers: ControlBarHandlers): void {
    this.element.innerHTML = `
      <button id="clear" type="button">Clear canvas</button>
      <button id="save" type="button">Save PNG</button>
      <button id="toggle-sync" type="button" aria-pressed="true">Sync: On</button>
      <button id="toggle-audio" type="button" aria-pressed="true">Audio: On</button>
    `;
    this.element.querySelector<HTMLButtonElement>("#clear")!.addEventListener("click", handlers.onClear);
    this.element.querySelector<HTMLButtonElement>("#save")!.addEventListener("click", handlers.onSave);
    this.syncBtn = this.element.querySelector<HTMLButtonElement>("#toggle-sync")!;
    this.audioBtn = this.element.querySelector<HTMLButtonElement>("#toggle-audio")!;
    this.syncBtn.addEventListener("click", handlers.onToggleSync);
    this.audioBtn.addEventListener("click", handlers.onToggleAudio);
  }
}
