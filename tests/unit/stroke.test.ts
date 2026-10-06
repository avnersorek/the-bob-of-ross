import { describe, it, expect } from "vitest";
import { Stroke, STROKE_MAX_POINTS } from "../../src/brush/Stroke";

function pt(x: number, y: number, time: number): { x: number; y: number; time: number } {
  return { x, y, time };
}

describe("Stroke", () => {
  it("computes frame-normalized velocity from timestamps", () => {
    const stroke = new Stroke(1);
    stroke.add(pt(0, 0, 0));
    stroke.add(pt(30, 0, 16.6667));
    const last = stroke.points[stroke.points.length - 1]!;
    expect(last.vel).toBeCloseTo(30, 4);
  });

  it("dedupes spatially identical points and keeps latest metadata", () => {
    const stroke = new Stroke(1);
    stroke.add(pt(5, 5, 0));
    stroke.add(pt(5, 5, 20));
    expect(stroke.points.length).toBe(1);
    expect(stroke.points[0]!.time).toBe(20);
  });

  it("caps recorded points", () => {
    const stroke = new Stroke(2);
    for (let i = 0; i <= STROKE_MAX_POINTS; i++) {
      stroke.add(pt(i * 2, 0, i));
    }
    expect(stroke.points.length).toBeLessThanOrEqual(STROKE_MAX_POINTS);
    expect(stroke.points[0]!.x).toBeGreaterThan(0);
  });

  it("resamples incrementally so samples only appear once", () => {
    const stroke = new Stroke(3);
    stroke.add(pt(0, 0, 0));
    stroke.add(pt(20, 0, 16.6667));
    const first = stroke.resample(2);
    const second = stroke.resample(2);
    for (const s of second) {
      for (const f of first) {
        expect(Math.hypot(f.x - s.x, f.y - s.y)).toBeGreaterThan(2 - 1e-6);
      }
    }
    expect(first[0]!.arcLen).toBe(0);
  });
});
