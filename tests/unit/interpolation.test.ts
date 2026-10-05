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
});