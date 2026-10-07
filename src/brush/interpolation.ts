import type { Point } from "./Brush";

export interface PathSample extends Point {
  x: number;
  y: number;
  angle: number;
  arcLen: number;
}

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const last = out[out.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-6) continue;
    out.push(p);
  }
  return out;
}

export function quadraticMidpointBezier(
  m0: Point,
  control: Point,
  m1: Point,
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * m0.x + 2 * u * t * control.x + t * t * m1.x,
    y: u * u * m0.y + 2 * u * t * control.y + t * t * m1.y,
  };
}

export function catmullRomSample(points: Point[], samplesPerSegment: number): Point[] {
  const pts = dedupe(points);
  if (pts.length < 2) return pts.slice();
  if (pts.length === 2) {
    const a = pts[0]!;
    const b = pts[1]!;
    const out: Point[] = [];
    for (let i = 0; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return out;
  }
  const out: Point[] = [{ x: pts[0]!.x, y: pts[0]!.y }];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let s = 1; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push({ x: pts[pts.length - 1]!.x, y: pts[pts.length - 1]!.y });
  return dedupe(out);
}

export function smoothPath(points: Point[], samplesPerCurve = 8): Point[] {
  const pts = dedupe(points);
  if (pts.length < 2) return pts.slice();
  if (pts.length === 2) {
    return pts.slice();
  }
  const out: Point[] = [{ x: pts[0]!.x, y: pts[0]!.y, vel: pts[0]!.vel }];
  const n = Math.max(2, Math.floor(samplesPerCurve));
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const m01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const m12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    for (let s = 0; s <= n; s++) {
      const pt = quadraticMidpointBezier(m01, p1, m12, s / n);
      const last = out[out.length - 1]!;
      if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 1e-6) {
        out.push({ x: pt.x, y: pt.y, vel: p1.vel });
      }
    }
  }
  const tail = out[out.length - 1]!;
  const lastRaw = pts[pts.length - 1]!;
  if (Math.hypot(lastRaw.x - tail.x, lastRaw.y - tail.y) >= 1e-6) {
    out.push({ x: lastRaw.x, y: lastRaw.y, vel: lastRaw.vel });
  }
  return out;
}

export function sampleByArcLength(
  path: Point[],
  step: number,
  fromCount = 0,
  offsetArc = 0
): PathSample[] {
  const pts = dedupe(path);
  if (pts.length < 2 || step <= 0) {
    return pts.map((p, i) => ({ x: p.x, y: p.y, angle: 0, arcLen: offsetArc + i * step, vel: p.vel }));
  }

  const samples: PathSample[] = [];
  let k = Math.max(0, Math.floor(fromCount));
  let walked = 0;
  let angle = 0;

  const cur = pts[0]!;
  if (k === 0 && offsetArc <= 0) {
    samples.push({ x: cur.x, y: cur.y, angle: 0, arcLen: 0, vel: cur.vel });
    k = 1;
  }

  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    if (segLen < 1e-9) continue;
    angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const segStart = walked;
    const segEnd = walked + segLen;
    const vel = p1.vel ?? p0.vel;
    while (k * step - offsetArc <= segEnd + 1e-9) {
      const target = k * step - offsetArc;
      if (target >= 0) {
        const t = Math.min(1, Math.max(0, (target - segStart) / segLen));
        const x = p0.x + (p1.x - p0.x) * t;
        const y = p0.y + (p1.y - p0.y) * t;
        samples.push({ x, y, angle, arcLen: k * step, vel });
      }
      k++;
    }
    walked = segEnd;
  }

  return samples;
}

export function getVelocity(p1: Point, p2: Point, dt: number): number {
  if (dt <= 0) return 0;
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return d / dt;
}

export function segmentVelocity(p1: Point, p2: Point): number {
  const dt = (p2.time ?? 0) - (p1.time ?? 0);
  if (dt <= 0) return 0;
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return (d / dt) * 16.6667;
}
