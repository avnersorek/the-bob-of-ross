import { formatTime } from "../util/time";
import type { EventBus } from "../core/state/eventBus";
import type { AppState } from "../core/state/AppState";
import type { SegmentStore } from "../core/sync/segmentStore";

export interface NowNextEntry {
  id: string;
  targetTime: number;
  toolName: string;
  color: string;
  countdown: number;
}

export function upcomingEntries(store: SegmentStore, time: number, count = 2): NowNextEntry[] {
  return store.nextSegments(time, count).map((n, i) => ({
    id: `next-${i}`,
    targetTime: n.segment.startTime,
    toolName: n.segment.tool.name,
    color: n.segment.tool.color,
    countdown: Math.ceil(n.inMs / 1000),
  }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function swatchHtml(color: string): string {
  return `<span class="hud-swatch" style="background:${escapeHtml(color)}" title="${escapeHtml(color)}"></span>`;
}

export class NowNextPanel {
  private element: HTMLDivElement;
  private timer = 0;

  constructor(
    private store: SegmentStore,
    private state: AppState,
    private bus: EventBus
  ) {
    this.element = document.createElement("div");
    this.element.id = "now-next";
    this.element.className = "now-next-panel";
    document.getElementById("app")!.appendChild(this.element);
    this.element.addEventListener("click", (ev) => this.onClick(ev));
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

  private onClick(ev: Event): void {
    const raw = (ev.target as Element | null)?.closest?.("[data-target-time]");
    if (!raw || !this.element.contains(raw)) return;
    const seconds = Number(raw.getAttribute("data-target-time"));
    if (!Number.isFinite(seconds)) return;
    ev.preventDefault();
    this.bus.emit("nav:seek", { time: seconds });
  }

  private render(): void {
    const t = this.state.currentTime;
    const current = this.store.segmentAt(t);
    const entries = upcomingEntries(this.store, t, 2);

    const active = document.activeElement;
    const focusedId = active && active.id && this.element.contains(active) ? active.id : null;

    const lines: string[] = [];
    if (current) {
      lines.push(this.plainLine("Current", `${current.tool.name} · ${current.tool.color}`));
    }
    for (const e of entries) {
      const rest = ` ${e.toolName} · ${e.color} · in ${formatTime(e.countdown)}`;
      const aria = `Jump to ${e.toolName} at ${formatTime(e.targetTime)}`;
      lines.push(
        `<button type="button" class="now-next-line now-next-upcoming now-next-jump" ` +
          `id="${escapeHtml(e.id)}" data-target-time="${e.targetTime}" ` +
          `aria-label="${escapeHtml(aria)}">` +
          `<span class="now-next-label">Next:</span>` +
          swatchHtml(e.color) +
          `<span class="now-next-rest">${escapeHtml(rest)}</span></button>`
      );
    }
    if (lines.length === 0) lines.push(this.plainLine("Current", "—"));

    this.element.innerHTML = lines.join("\n");

    if (focusedId) {
      const el = this.element.querySelector<HTMLElement>(`[id="${focusedId}"]`);
      if (el) el.focus();
    }
  }

  private plainLine(label: string, rest: string): string {
    const colorMatch = rest.match(/#[0-9a-fA-F]{6}/);
    const swatch = colorMatch ? swatchHtml(colorMatch[0]) : "";
    return (
      `<div class="now-next-line"><span class="now-next-label">${label}:</span>` +
      `${swatch}<span class="now-next-rest">${escapeHtml(rest)}</span></div>`
    );
  }
}
