import { describe, expect, it } from "vitest";
import { SyncEngine } from "./SyncEngine";

describe("SyncEngine implicit seek detection", () => {
  it("treats a 6s jump while playing as seek-driven without seek()", () => {
    const events: Array<{ name: string }> = [];
    const store: any = {
      segments: [
        { startTime: 0, tool: "a" },
        { startTime: 5, tool: "b" },
      ],
      duration: 10,
      indexAt: (t: number) => (t >= 5 ? 1 : 0),
    };
    const bus: any = { emit: (name: string) => events.push({ name }) };
    const state: any = {
      currentTime: 0,
      timeToNext: Infinity,
      activeSegment: null,
      activeSegmentIndex: -1,
      nextSegment: null,
      syncEnabled: false,
      activeTool: null,
      pauseAtToolEnd: true,
    };
    const timeSource: any = {
      getCurrentTime: () => 0,
      getState: () => "playing",
      isAdvancing: () => true,
    };
    const brushes: any = { forTool: () => ({ prepare: () => {} }) };
    const engine = new SyncEngine(timeSource, store, bus, state, brushes);

    engine.evaluateAt(0);
    events.length = 0;
    engine.evaluateAt(6);

    expect(state.activeSegment.tool).toBe("b");
    expect(events.some((e) => e.name === "tool:end")).toBe(false);
  });
});
