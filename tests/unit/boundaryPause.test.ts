import { describe, it, expect } from "vitest";
import { shouldAutoPauseAtBoundary } from "../../src/core/sync/boundaryPause";
import { SyncEngine } from "../../src/core/sync/SyncEngine";
import { SegmentStore } from "../../src/core/sync/segmentStore";
import { loadScript } from "../../src/core/sync/scriptLoader";
import { EventBus } from "../../src/core/state/eventBus";
import { AppState } from "../../src/core/state/AppState";
import { BrushFactory } from "../../src/brush/BrushFactory";

const naturalCrossing = {
  prevIndex: 2,
  index: 3,
  prevTime: 251.6,
  time: 252.1,
  seekDriven: false,
  playing: true,
  enabled: true,
  lastFiredIndex: null,
};

describe("shouldAutoPauseAtBoundary", () => {
  it("fires on natural progression across a segment boundary", () => {
    expect(shouldAutoPauseAtBoundary(naturalCrossing)).toBe(true);
  });

  it("does not fire for seek-driven changes", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, seekDriven: true })).toBe(false);
  });

  it("does not fire while the player is not playing", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, playing: false })).toBe(false);
  });

  it("does not fire when the feature is toggled off", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, enabled: false })).toBe(false);
  });

  it("does not fire when the segment index did not change", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, index: 2 })).toBe(false);
  });

  it("does not fire on a backwards segment change", () => {
    expect(
      shouldAutoPauseAtBoundary({
        ...naturalCrossing,
        prevIndex: 3,
        index: 2,
        time: 251.6,
        prevTime: 252.1,
      })
    ).toBe(false);
  });

  it("does not fire when the crossing skips segments", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, index: 4 })).toBe(false);
  });

  it("does not fire when time did not move forward", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, time: 251.6 })).toBe(false);
  });

  it("does not fire before any segment was active", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, prevIndex: -1, index: 0 })).toBe(false);
  });

  it("does not fire twice for the same boundary", () => {
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, lastFiredIndex: 3 })).toBe(false);
    expect(shouldAutoPauseAtBoundary({ ...naturalCrossing, lastFiredIndex: 2 })).toBe(true);
  });
});

class FakeTimeSource {
  time = 0;
  state: "playing" | "paused" | "ended" = "playing";
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
    return this.state === "playing";
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
  const ends: { index: number; finished: any; next: any }[] = [];
  bus.on("tool:end", (p) => ends.push(p));
  return { store, bus, state, timeSource, engine, ends };
}

describe("SyncEngine tool:end", () => {
  it("emits exactly once when playback naturally walks into the next segment", () => {
    const { timeSource, engine, ends } = setup();

    timeSource.time = 130.4;
    engine.evaluateAt(130.4);
    expect(ends).toHaveLength(0);

    timeSource.time = 131.2;
    engine.evaluateAt(131.2);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.index).toBe(1);
    expect(ends[0]!.finished.name).toBe("Intro — no paint");
    expect(ends[0]!.next.name).toBe("2½-inch Brush");

    timeSource.time = 132.4;
    engine.evaluateAt(132.4);
    expect(ends).toHaveLength(1);
  });

  it("does not emit when the segment changes because of a seek", () => {
    const { timeSource, engine, ends } = setup();

    timeSource.time = 130.4;
    engine.evaluateAt(130.4);

    timeSource.time = 900;
    engine.seek(900);
    engine.evaluateAt(900);
    expect(ends).toHaveLength(0);

    timeSource.time = 901;
    engine.evaluateAt(901);
    expect(ends).toHaveLength(0);
  });

  it("does not emit for a seek that lands just across an adjacent boundary", () => {
    const { timeSource, engine, ends } = setup();

    timeSource.time = 130.4;
    engine.evaluateAt(130.4);

    timeSource.time = 131.6;
    engine.seek(131.6);
    engine.evaluateAt(131.6);
    expect(ends).toHaveLength(0);
  });

  it("does not emit while the player is paused", () => {
    const { timeSource, engine, ends } = setup();

    timeSource.state = "paused";
    timeSource.time = 130.4;
    engine.evaluateAt(130.4);
    timeSource.time = 131.2;
    engine.evaluateAt(131.2);
    expect(ends).toHaveLength(0);
  });

  it("does not emit when pause-at-tool-end is turned off", () => {
    const { state, timeSource, engine, ends } = setup();
    state.pauseAtToolEnd = false;

    timeSource.time = 130.4;
    engine.evaluateAt(130.4);
    timeSource.time = 131.2;
    engine.evaluateAt(131.2);
    expect(ends).toHaveLength(0);
  });
});
