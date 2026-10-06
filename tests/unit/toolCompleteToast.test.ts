// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ToolCompleteToast } from "../../src/ui/ToolCompleteToast";
import { EventBus } from "../../src/core/state/eventBus";
import type { ToolConfig } from "../../src/data/script.schema";

const finishedTool: ToolConfig = {
  name: "2-inch Brush",
  color: "#2C5282",
  type: "sky_wash",
  opacity: 0.4,
  size: 50,
  blendMode: "multiply",
};

const nextTool: ToolConfig = {
  name: "Fan Brush",
  color: "#1A365D",
  type: "pine_tree_foliage",
  opacity: 0.5,
  size: 30,
  blendMode: "source-over",
};

class FakePlayer {
  playCount = 0;
  pauseCount = 0;
  play() {
    this.playCount++;
  }
  pause() {
    this.pauseCount++;
  }
}

describe("ToolCompleteToast", () => {
  let bus: EventBus;
  let player: FakePlayer;
  let toast: ToolCompleteToast;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    bus = new EventBus();
    player = new FakePlayer();
    toast = new ToolCompleteToast(bus, player);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("starts hidden, empty and announced politely", () => {
    const el = document.getElementById("tool-complete")!;
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-live")).toBe("polite");
    expect(toast.isVisible()).toBe(false);
    expect(el.textContent).toBe("");
    expect(document.getElementById("continue")).toBeNull();
  });

  it("pauses the player and shows the finished and next tool", () => {
    bus.emit("tool:end", { index: 1, finished: finishedTool, next: nextTool });

    expect(player.pauseCount).toBe(1);
    const el = document.getElementById("tool-complete")!;
    expect(toast.isVisible()).toBe(true);
    expect(el.textContent).toContain("Done:");
    expect(el.textContent).toContain("2-inch Brush · #2C5282");
    expect(el.textContent).toContain("Next:");
    expect(el.textContent).toContain("Fan Brush · #1A365D");
    expect(el.querySelector(".hud-swatch")).toBeTruthy();
    expect(el.querySelector(".tool-complete-tick")).toBeTruthy();
    expect(document.getElementById("continue")).toBeTruthy();
  });

  it("resumes playback and dismisses the toast on Continue", () => {
    bus.emit("tool:end", { index: 1, finished: finishedTool, next: nextTool });

    (document.getElementById("continue") as HTMLButtonElement).click();

    expect(player.playCount).toBe(1);
    const el = document.getElementById("tool-complete")!;
    expect(toast.isVisible()).toBe(false);
    expect(el.textContent).toBe("");
    expect(document.getElementById("continue")).toBeNull();
  });

  it("treats Space on Continue as activation without leaking to global shortcuts", () => {
    bus.emit("tool:end", { index: 1, finished: finishedTool, next: nextTool });
    const button = document.getElementById("continue") as HTMLButtonElement;
    const event = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });

    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(player.playCount).toBe(1);
    expect(toast.isVisible()).toBe(false);
  });

  it("dismisses the toast on a seek", () => {
    bus.emit("tool:end", { index: 1, finished: finishedTool, next: nextTool });
    expect(toast.isVisible()).toBe(true);

    bus.emit("player:seek", { time: 900 });

    expect(toast.isVisible()).toBe(false);
    expect(document.getElementById("tool-complete")!.textContent).toBe("");
  });

  it("replaces an open toast when the next tool ends", () => {
    bus.emit("tool:end", { index: 1, finished: finishedTool, next: nextTool });
    bus.emit("tool:end", { index: 2, finished: nextTool, next: null });

    const el = document.getElementById("tool-complete")!;
    expect(el.textContent).toContain("Fan Brush · #1A365D");
    expect(el.textContent).toContain("End of episode");
    expect(player.pauseCount).toBe(2);
  });
});
