import type { Point } from "./Brush";

export function smoothPath(points: Point[], _spacing: number): Point[] {
  if (points.length < 2) return points.slice();
  const smoothed: Point[] = [];
  smoothed.push({ x: points[0]!.x, y: points[0]!.y });

  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const m01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const m12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    smoothed.push(m01);
    smoothed.push(m12);
  }
  smoothed.push({ x: points[points.length - 1]!.x, y: points[points.length - 1]!.y });
  return smoothed;
}

export function sampleByArcLength(path: Point[], step: number): Array<{ point: Point; arcLen: number }> {
  if (path.length < 2 || step <= 0) return path.map((p, i) => ({ point: p, arcLen: i * step }));
  const samples: Array<{ point: Point; arcLen: number }> = [];
  let dist = 0;
  samples.push({ point: path[0]!, arcLen: 0 });
  for (let i = 1; i < path.length; i++) {
    const p0 = path[i - 1]!;
    const p1 = path[i]!;
    const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    dist += segLen;
    if (dist >= step * samples.length) {
      samples.push({ point: p1, arcLen: dist });
    }
  }
  return samples;
}

export function getVelocity(p1: Point, p2: Point, dt: number): number {
  if (dt <= 0) return 0;
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return d / dt;
}
