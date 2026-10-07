import type { EventBus } from "../core/state/eventBus";
import type { AppState } from "../core/state/AppState";
import type { ToolConfig } from "../data/script.schema";

export class ToolHud {
  private element: HTMLDivElement;

  constructor(
    _container: HTMLElement,
    bus: EventBus,
    private state: AppState,
    _fallback: ToolConfig
  ) {
    this.element = document.getElementById("tool-hud") as HTMLDivElement;
    this.element.classList.remove("hidden");
    bus.on("tool:change", () => this.update());
    bus.on("segment:change", () => this.update());
    bus.on("player:seek", () => this.update());
    bus.on("player:state", () => this.update());
    bus.on("sync:toggle", () => this.update());
    this.update();
  }

  private liveTool(): ToolConfig | null {
    return this.state.activeTool;
  }

  update(): void {
    const tool = this.liveTool();
    if (tool) {
      this.element.innerHTML =
        `Tool: <span class="hud-swatch" style="background:${tool.color}" title="${tool.color}"></span>${tool.name} ` +
        `| Color: ${tool.color} | Mode: ${tool.type}`;
    } else {
      this.element.textContent = "Tool: —";
    }
    this.element.classList.remove("hidden");
  }
}
