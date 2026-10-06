import type { EventBus } from "../core/state/eventBus";
import type { ToolConfig } from "../data/script.schema";

export interface ToolEndPayload {
  index: number;
  finished: ToolConfig | null;
  next: ToolConfig | null;
}

export interface ToolEndPlayer {
  play(): void;
  pause(): void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function swatch(tool: ToolConfig | null): string {
  if (!tool) return "";
  const color = escapeHtml(tool.color);
  return `<span class="hud-swatch" style="background:${color}" title="${color}"></span>`;
}

export class ToolCompleteToast {
  private element: HTMLElement;

  constructor(
    private bus: EventBus,
    private player: ToolEndPlayer
  ) {
    this.element = document.getElementById("tool-complete") ?? this.create();
    this.bus.on("tool:end", (payload) => this.toolEnded(payload));
    this.bus.on("player:seek", () => this.dismiss());
    this.bus.on("nav:seek", () => this.dismiss());
    this.dismiss();
  }

  private create(): HTMLElement {
    const el = document.createElement("div");
    el.id = "tool-complete";
    el.className = "tool-complete hidden";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    (document.getElementById("app") ?? document.body).appendChild(el);
    return el;
  }

  /** Single pause + notify code path, used by the sync engine and by __bob.simulateToolEnd(). */
  toolEnded(payload: ToolEndPayload): void {
    this.player.pause();
    this.render(payload);
  }

  dismiss(): void {
    this.element.classList.add("hidden");
    this.element.textContent = "";
  }

  isVisible(): boolean {
    return !this.element.classList.contains("hidden");
  }

  private render(payload: ToolEndPayload): void {
    const { finished, next } = payload;
    const doneText = finished
      ? `${escapeHtml(finished.name)} · ${escapeHtml(finished.color)}`
      : "—";
    const nextText = next
      ? `${escapeHtml(next.name)} · ${escapeHtml(next.color)}`
      : "End of episode";

    this.element.innerHTML =
      `<span class="tool-complete-tick" aria-hidden="true">&#10003;</span>` +
      `<span class="tool-complete-text"><strong>Done:</strong> ${swatch(finished)}${doneText} ` +
      `<span class="tool-complete-sep">—</span> ` +
      `<strong>Next:</strong> ${swatch(next)}${nextText}</span>` +
      `<button id="continue" type="button">Continue</button>`;

    this.element.classList.remove("hidden");

    const button = this.element.querySelector<HTMLButtonElement>("#continue");
    button?.addEventListener("click", this.onContinue);
    button?.addEventListener("keydown", this.onKeyDown);
  }

  private onContinue = (): void => {
    this.dismiss();
    this.player.play();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== " " && event.code !== "Space") return;
    event.preventDefault();
    event.stopPropagation();
    this.onContinue();
  };
}
