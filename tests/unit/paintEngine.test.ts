import { describe, expect, it } from "vitest";
import { PaintEngine } from "../../src/brush/BrushEngine";

describe("PaintEngine.clear", () => {
  it("resets the painted latch", () => {
    const engine = new PaintEngine({} as any, {} as any, { canvas: { width: 1 } } as any);
    engine.painted = true;
    engine.clear();
    expect(engine.painted).toBe(false);
  });
});
