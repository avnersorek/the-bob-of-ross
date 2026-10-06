import type { Point } from "./Brush";
import { smoothPath, sampleByArcLength, type PathSample } from "./interpolation";

export const STROKE_MAX_POINTS = 2048;

export class Stroke {
  readonly points: Point[] = [];
  readonly seed: number;
  private emittedCount = 0;
  private smoothingCache: Point[] | null = null;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  get length(): number {
    return this.points.length;
  }

  add(p: Point): void {
    let point = p;
    const last = this.points[this.points.length - 1];
    if (last && point.time !== undefined && last.time !== undefined && point.time < last.time) {
      point = { ...p, time: last.time };
    }
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1e-6) {
      if (point.pressure !== undefined) last.pressure = point.pressure;
      if (point.vel !== undefined) last.vel = point.vel;
      if (point.time !== undefined) last.time = point.time;
      this.smoothingCache = null;
      return;
    }
    if (last && point.time !== undefined && last.time !== undefined) {
      const dt = Math.max(0, point.time - last.time);
      const d = Math.hypot(point.x - last.x, point.y - last.y);
      point.vel = dt > 0 ? (d / dt) * 16.6667 : (last.vel ?? 0);
    } else {
      point.vel = last?.vel ?? 0;
    }
    this.points.push({ ...point });
    if (this.points.length > STROKE_MAX_POINTS) {
      this.points.shift();
    }
    this.smoothingCache = null;
  }

  smoothed(): Point[] {
    if (!this.smoothingCache) {
      this.smoothingCache = smoothPath(this.points, 8);
    }
    return this.smoothingCache;
  }

  resample(step: number): PathSample[] {
    if (step <= 0 || this.points.length < 2) return [];
    const base = this.emittedCount;
    const samples = sampleByArcLength(this.smoothed(), step, base);
    this.emittedCount = base + samples.length;
    return samples;
  }
}
