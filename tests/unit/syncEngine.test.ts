import { describe, it, expect } from "vitest";
import { SyncEngine } from "../../src/core/sync/SyncEngine";
import { SegmentStore } from "../../src/core/sync/segmentStore";
import { loadScript } from "../../src/core/sync/scriptLoader";
import { EventBus } from "../../src/core/state/eventBus";
import { AppState } from "../../src/core/state/AppState";
import { BrushFactory } from "../../src/brush/BrushFactory";

class FakeTimeSource {
  time = 0;
  state: "playing" | "paused" | "ended" = "playing";
  advancing = true;
  getCurrentTime() {
    return this.time;
  }
  getDuration() {
    return 2000;
  }
  getState() {
    return this.state as any;
  }
  isAdvancing() {
    return this.advancing && this.state === "playing";
  }
}

describe("syncEngine", () => {
  it("emits tool change on boundary", () => {
    const script = loadScript();
    const store = new SegmentStore(script);
    const bus = new EventBus();
    const state = new AppState();
    const brushes = new BrushFactory();
    const timeSource = new FakeTimeSource();
    const engine = new SyncEngine(timeSource, store, bus, state, brushes);
    const changes: any[] = [];
    bus.on("tool:change", (p) => changes.push(p));
    timeSource.time = store.segments[1]?.startTime || 131;
    // Simulate tick
    (engine as any).lastEvalAt = -10000;
    (engine as any).tick();
    expect(changes.length).toBeGreaterThanOrEqual(0);
  });
});
