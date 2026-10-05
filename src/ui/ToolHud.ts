import type { EventBus } from "../core/state/eventBus";
import type { ToolConfig } from "../data/script.schema";

export class ToolHud {
  private element: HTMLDivElement;

  constructor(_container: HTMLElement, bus: EventBus) {
    this.element = document.getElementById("tool-hud") as HTMLDivElement;
    this.element.classList.remove("hidden");
    bus.on("tool:change", (payload) => this.update(payload.next as ToolConfig | null));
  }

  update(tool: ToolConfig | null = null): void {
    if (tool) {
      this.element.textContent = `Tool: ${tool.name} | Color: ${tool.color} | Mode: ${tool.type}`;
    } else {
      this.element.textContent = "Tool: —";
    }
    this.element.classList.remove("hidden");
  }
}
