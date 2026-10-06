import { describe, it, expect } from "vitest";
import { SyncEngine } from "../../src/core/sync/SyncEngine";
import { SegmentStore } from "../../src/core/sync/segmentStore";
import { loadScript } from "../../src/core/sync/scriptLoader";
import { EventBus } from "../../src/core/state/eventBus";
import { AppState } from "../../src/core/state/AppState";
import { BrushFactory } from "../../src/brush/BrushFactory";

class FakeTimeSource {
  time = 0;
  state: "playing" | "paused" | "ended" = "paused";
  getCurrentTime() {
    return this.time;
  }
  getDuration() {
    return 1665;
  }
  getState() {
    return this.state as any;
  }
  isAdvancing() {
    return false;
  }
}

function setup() {
  const script = loadScript();
  const store = new SegmentStore(script);
  const bus = new EventBus();
  const state = new AppState();
  const brushes = new BrushFactory();
  const timeSource = new FakeTimeSource();
  const engine = new SyncEngine(timeSource, store, bus, state, brushes);
  return { store, bus, state, timeSource, engine };
}

describe("seek -> segment lookup", () => {
  it("recomputes the active segment instantly on seek", () => {
    const { store, bus, state, timeSource, engine } = setup();
    const changes: number[] = [];
    bus.on("segment:change", (p) => changes.push((p as { index: number }).index));

    timeSource.time = 900;
    engine.seek(900);
    engine.evaluateNow();

    expect(state.currentTime).toBe(900);
    expect(store.segmentAt(900)?.tool.name).toBe("Palette Knife");
    expect(state.activeSegmentIndex).toBe(store.indexAt(900));
    expect(state.activeSegment?.tool.name).toBe("Palette Knife");
    expect(state.activeTool?.name).toBe("Palette Knife");
    expect(state.activeTool?.color).toBe("#4A3728");
    expect(changes).toContain(store.indexAt(900));
  });

  it("keeps the active tool equal to the segment for the player time across seeks", () => {
    const { store, state, timeSource, engine } = setup();

    for (const t of [250, 900, 100, 1600, 0, 250]) {
      timeSource.time = t;
      engine.seek(t);
      engine.evaluateNow();

      const expected = store.segmentAt(t);
      expect(state.currentTime).toBe(t);
      expect(state.activeSegment).toEqual(expected);
      expect(state.activeSegmentIndex).toBe(store.indexAt(t));
      expect(state.activeTool).toEqual(expected?.tool ?? null);
    }
  });

  it("emits tool change when a seek crosses a segment boundary", () => {
    const { bus, state, timeSource, engine } = setup();
    const tools: (string | undefined)[] = [];
    bus.on("tool:change", (p) => tools.push((p as { next: { name: string } }).next?.name));

    timeSource.time = 10;
    engine.seek(10);
    engine.evaluateNow();

    timeSource.time = 900;
    engine.seek(900);
    engine.evaluateNow();

    expect(state.activeTool?.name).toBe("Palette Knife");
    expect(tools).toContain("Palette Knife");
  });

  it("a seek back re-syncs the panel state to the earlier segment", () => {
    const { store, state, timeSource, engine } = setup();

    timeSource.time = 900;
    engine.seek(900);
    engine.evaluateNow();
    expect(state.activeTool?.name).toBe("Palette Knife");

    timeSource.time = 250;
    engine.seek(250);
    engine.evaluateNow();
    expect(state.activeSegmentIndex).toBe(store.indexAt(250));
    expect(state.activeTool?.name).toBe("2-inch Brush");
    expect(state.activeTool?.color).toBe("#E8DC7A");
  });
});
