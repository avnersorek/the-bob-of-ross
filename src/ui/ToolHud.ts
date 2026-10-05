import type { EventBus } from "../core/state/eventBus";

export class ToolHud {
  private element: HTMLDivElement;

  constructor(container: HTMLElement, private bus: EventBus) {
    this.element = document.createElement("div");
    this.element.id = "tool-hud";
    container.appendChild(this.element);
    this.bus.on("tool:change", () => this.update());
  }

  update(tool: any = null): void {
    if (tool?.next) {
      const t = tool.next;
      this.element.textContent = `Tool: ${t.name} | Color: ${t.color} | Mode: ${t.type}`;
    } else {
      this.element.textContent = "Tool: —";
    }
    this.element.classList.remove("hidden");
  }
}