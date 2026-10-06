import { formatTime } from "../util/time";
import type { EventBus } from "../core/state/eventBus";
import type { AppState } from "../core/state/AppState";
import type { SegmentStore } from "../core/sync/segmentStore";

export class NowNextPanel {
  private element: HTMLDivElement;
  private timer = 0;

  constructor(
    private store: SegmentStore,
    private state: AppState,
    bus: EventBus
  ) {
    this.element = document.createElement("div");
    this.element.id = "now-next";
    this.element.className = "now-next-panel";
    document.getElementById("app")!.appendChild(this.element);
    bus.on("segment:change", () => this.render());
    bus.on("tool:change", () => this.render());
    bus.on("player:seek", () => this.render());
    bus.on("player:state", () => this.render());
    bus.on("sync:toggle", () => this.render());
    if (typeof window !== "undefined") {
      this.timer = window.setInterval(() => this.render(), 1000);
    }
    this.render();
  }

  dispose(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.element.remove();
  }

  private render(): void {
    const t = this.state.currentTime;
    const current = this.store.segmentAt(t);
    const nexts = this.store.nextSegments(t, 2);

    const lines: string[] = [];
    if (current) {
      lines.push(`Current: ${current.tool.name} · ${current.tool.color}`);
    }
    for (const n of nexts) {
      lines.push(
        `Next: ${n.segment.tool.name} · ${n.segment.tool.color} · in ${formatTime(Math.ceil(n.inMs / 1000))}`
      );
    }
    if (lines.length === 0) lines.push("Current: —");

    this.element.innerHTML = lines
      .map((line) => {
        const colon = line.indexOf(":");
        const label = line.slice(0, colon);
        const rest = line.slice(colon + 1);
        const isNext = label === "Next";
        const colorMatch = rest.match(/#[0-9a-fA-F]{6}/);
        const swatch = colorMatch
          ? `<span class="hud-swatch" style="background:${colorMatch[0]}" title="${colorMatch[0]}"></span>`
          : "";
        return `<div class="now-next-line${isNext ? " now-next-upcoming" : ""}"><span class="now-next-label">${label}:</span>${swatch}<span class="now-next-rest">${rest}</span></div>`;
      })
      .join("\n");
  }
}
