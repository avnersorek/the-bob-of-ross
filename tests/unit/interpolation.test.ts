import { describe, it, expect } from "vitest";
import { smoothPath, sampleByArcLength } from "../../src/brush/interpolation";

describe("interpolation", () => {
  it("smooths path with valid spacing", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ];
    const smoothed = smoothPath(points, 5);
    expect(smoothed.length).toBeGreaterThan(points.length);
  });

  it("samples by arc length", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const samples = sampleByArcLength(path, 5);
    expect(samples.length).toBeGreaterThan(0);
  });

  it("produces uniformly spaced arc-length samples", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
    ];
    const step = 5;
    const samples = sampleByArcLength(path, step);
    for (let i = 1; i < samples.length; i++) {
      const d = Math.hypot(samples[i]!.x - samples[i - 1]!.x, samples[i]!.y - samples[i - 1]!.y);
      expect(d).toBeCloseTo(step, 3);
      expect(samples[i]!.arcLen).toBeCloseTo(i * step, 6);
    }
    expect(samples[0]!.arcLen).toBe(0);
  });

  it("continues from a non-zero sample count", () => {
    const step = 5;
    const first = sampleByArcLength(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      step,
      0
    );
    expect(first.length).toBe(9);
    expect(first[first.length - 1]!.arcLen).toBe(40);
    const extended = sampleByArcLength(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
      step,
      first.length
    );
    expect(extended.length).toBeGreaterThan(0);
    for (const s of extended) {
      expect(s.arcLen).toBeGreaterThanOrEqual(first.length * step);
      for (const f of first) {
        expect(Math.hypot(f.x - s.x, f.y - s.y)).toBeGreaterThan(step - 1e-6);
      }
    }
  });
});
