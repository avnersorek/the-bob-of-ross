import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { flowOf, applyStrokeStyle } from "../brushCommon";
import { clamp, lerp, mulberry32, randRange } from "../../util/math";

export type PineMode = "cluster" | "ribbon";

const MODE_THRESHOLD = 18;

export class PineTreeBrush implements Brush {
  mode: PineMode = "cluster";
  private tool: ToolConfig | null = null;
  private sampleIndex = 0;
  private prev: Point | null = null;
  private arc = 0;
  private lastTwigArc = 0;
  private seedBase = 0;

  prepare(_tool: ToolConfig): void {}

  static modeFor(size: number): PineMode {
    return size >= MODE_THRESHOLD ? "cluster" : "ribbon";
  }

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    const { tool, pos, seed } = context;
    if (tool.opacity === 0) return;
    this.tool = tool;
    this.mode = PineTreeBrush.modeFor(tool.size);
    this.sampleIndex = 0;
    this.prev = null;
    this.arc = 0;
    this.lastTwigArc = 0;
    this.seedBase = seed >>> 0;
    applyStrokeStyle(ctx, tool);
    if (this.mode === "cluster") {
      this.stampCluster(ctx, pos.x, pos.y, pos.angle ?? -Math.PI / 2);
    }
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    if (!this.tool) return;
    if (this.mode === "cluster") {
      for (const p of points) {
        this.stampCluster(ctx, p.x, p.y, p.angle ?? -Math.PI / 2);
      }
    } else {
      for (const p of points) {
        this.ribbonSample(ctx, p);
      }
    }
  }

  private stampCluster(ctx: CanvasRenderingContext2D, x: number, y: number, axis: number): void {
    const tool = this.tool!;
    const n = Math.round(lerp(7, 11, clamp(tool.size / 30, 0, 1)));
    const width = Math.max(1, tool.size * 0.04);
    const rand = mulberry32((this.seedBase ^ (this.sampleIndex * 2654435761)) >>> 0);
    for (let k = 0; k < n; k++) {
      const dir = axis + (k / n) * 1.2 - 0.6 + randRange(rand, -0.08, 0.08);
      const len = tool.size * (0.6 + 0.5 * rand());
      const alpha = tool.opacity * (0.7 + 0.3 * rand());
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(dir) * len, y + Math.sin(dir) * len);
      ctx.stroke();
      ctx.restore();
    }
    this.sampleIndex++;
  }

  private ribbonSample(ctx: CanvasRenderingContext2D, p: Point): void {
    const tool = this.tool!;
    if (!this.prev) {
      this.prev = p;
      return;
    }
    const flow = flowOf(tool);
    const L = Math.max(p.arcLen ?? this.arc, tool.size);
    const center = L / 2;
    const taper = 0.55 + 0.45 * (1 - Math.abs((p.arcLen ?? this.arc) - center) / center);
    ctx.save();
    ctx.globalAlpha = tool.opacity;
    ctx.lineWidth = Math.max(1, tool.size * taper * (0.7 + 0.3 * flow));
    ctx.beginPath();
    ctx.moveTo(this.prev.x, this.prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    if ((p.arcLen ?? this.arc) - this.lastTwigArc >= tool.size * 2) {
      this.lastTwigArc = p.arcLen ?? this.arc;
      this.drawTwigs(ctx, p, tool, flow);
    }
    this.prev = p;
    this.arc = p.arcLen ?? this.arc;
  }

  private drawTwigs(
    ctx: CanvasRenderingContext2D,
    p: Point,
    tool: ToolConfig,
    _flow: number
  ): void {
    const r = mulberry32(((this.sampleIndex * 0x85ebca6b) ^ 0xc2b2ae35) >>> 0);
    const base = p.angle ?? 0;
    ctx.save();
    ctx.globalAlpha = tool.opacity;
    ctx.lineWidth = Math.max(1, tool.size * 0.15);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const ang = base + side * randRange(r, 0.5, 1.1);
      const len = tool.size * randRange(r, 0.4, 0.9);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.restore();
    this.sampleIndex++;
  }

  endStroke(): void {
    this.tool = null;
  }
}
