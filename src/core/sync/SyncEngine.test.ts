import { describe, it, expect, vi, afterEach } from "vitest";
import { SyncEngine } from "./SyncEngine";

function makeEngine() {
  const timeSource = {
    getCurrentTime: () => 0,
    getState: () => "paused",
    isAdvancing: () => false,
  };
  const store = {
    segments: [{ startTime: 0, tool: { name: "brush" } }],
    indexAt: () => 0,
    duration: 10,
  };
  const bus = { emit: vi.fn() };
  const state: any = { syncEnabled: false, timeToNext: 9999 };
  const brushes: any = { forTool: () => ({ prepare: () => {} }) };
  const engine = new SyncEngine(timeSource as any, store as any, bus as any, state, brushes);
  let evaluated = 0;
  const orig = engine.evaluateAt.bind(engine);
  engine.evaluateAt = (t: number) => {
    evaluated++;
    orig(t);
  };
  return { engine, get evaluated() { return evaluated; } };
}

describe("SyncEngine", () => {
  afterEach(() => vi.restoreAllMocks());

  it("start() does not schedule requestAnimationFrame", () => {
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    const { engine } = makeEngine();
    engine.start();
    expect(raf).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("poll() evaluates on the 250ms cadence", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { engine } = makeEngine();
    let evaluatedCount = 0;
    const orig = engine.evaluateAt.bind(engine);
    engine.evaluateAt = (t: number) => { evaluatedCount++; orig(t); };
    engine.tick();
    expect(evaluatedCount).toBe(1);
    now = 1100;
    engine.tick();
    expect(evaluatedCount).toBe(1);
    now = 1300;
    engine.tick();
    expect(evaluatedCount).toBe(2);
  });
});
