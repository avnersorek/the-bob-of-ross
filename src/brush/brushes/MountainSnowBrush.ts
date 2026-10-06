import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { flowOf, applyStrokeStyle } from "../brushCommon";
import { clamp, lerp, mulberry32, randRange } from "../../util/math";

export class MountainSnowBrush implements Brush {
  private tool: ToolConfig | null = null;
  private sampleIndex = 0;
  private prev: Point | null = null;
  private arc = 0;
  private seedBase = 0;

  prepare(_tool: ToolConfig): void {}

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    const { tool, pos, seed } = context;
    if (tool.opacity === 0) return;
    this.tool = tool;
    this.sampleIndex = 0;
    this.prev = pos;
    this.arc = 0;
    this.seedBase = seed >>> 0;
    applyStrokeStyle(ctx, tool);
    ctx.globalAlpha = tool.opacity;
    ctx.lineWidth = Math.max(1, tool.size * 0.12);
    if (!tool.breakTexture) {
      ctx.beginPath();
    }
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    const tool = this.tool;
    if (!tool) return;
    for (const p of points) {
      if (tool.breakTexture) {
        this.breakingSample(ctx, tool, p);
      } else {
        this.solidSample(ctx, tool, p);
      }
    }
  }

  private solidSample(ctx: CanvasRenderingContext2D, tool: ToolConfig, p: Point): void {
    if (!this.prev) {
      this.prev = p;
      return;
    }
    const arc = p.arcLen ?? this.arc;
    const L = Math.max(arc, tool.size);
    const center = L / 2;
    const taper = 0.7 + 0.3 * (1 - Math.abs(arc - center) / center);
    const w = Math.max(0.5, (tool.size / 2) * taper);
    ctx.save();
    ctx.globalAlpha = tool.opacity;
    ctx.lineWidth = Math.max(1, w * 2);
    ctx.beginPath();
    ctx.moveTo(this.prev.x, this.prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    this.prev = p;
    this.arc = arc;
  }

  private breakingSample(ctx: CanvasRenderingContext2D, tool: ToolConfig, p: Point): void {
    const flow = flowOf(tool);
    const v = p.vel ?? 0;
    const dryness = clamp(v / 12, 0, 1);
    const flecks = Math.round(lerp(4, 1, dryness));
    const dashLen = tool.size * lerp(0.9, 0.25, dryness);
    const tangent = p.angle ?? 0;
    const nx = -Math.sin(tangent);
    const ny = Math.cos(tangent);
    const rand = mulberry32((this.seedBase ^ (this.sampleIndex * 2654435761)) >>> 0);
    const halfW = Math.max(1, (tool.size / 2) * randRange(rand, 0.9, 1.1));
    ctx.save();
    ctx.globalAlpha = tool.opacity;
    ctx.lineWidth = Math.max(1, tool.size * 0.12);
    ctx.lineCap = "round";
    for (let k = 0; k < flecks; k++) {
      if (rand() < 0.15 * (1 - flow)) continue;
      const off = randRange(rand, -halfW, halfW);
      const bx = p.x + nx * off;
      const by = p.y + ny * off;
      const len = dashLen * randRange(rand, 0.6, 1.4);
      const ang = tangent + Math.PI / 2 + randRange(rand, -0.2, 0.2);
      ctx.beginPath();
      ctx.moveTo(bx - Math.cos(ang) * (len / 2), by - Math.sin(ang) * (len / 2));
      ctx.lineTo(bx + Math.cos(ang) * (len / 2), by + Math.sin(ang) * (len / 2));
      ctx.stroke();
    }
    ctx.globalAlpha = tool.opacity * 0.45;
    ctx.fillStyle = tool.color;
    const speckleRand = mulberry32(((this.sampleIndex * 0x9e3779b9) ^ this.seedBase) >>> 0);
    for (let sp = 0; sp < 3; sp++) {
      const spAngle = speckleRand() * Math.PI * 2;
      const spRad = 1.2 * (tool.size / 2) * speckleRand();
      ctx.fillRect(p.x + Math.cos(spAngle) * spRad, p.y + Math.sin(spAngle) * spRad, 1, 1);
    }
    ctx.restore();
    this.prev = p;
    this.arc = p.arcLen ?? this.arc;
    this.sampleIndex++;
  }

  endStroke(): void {
    this.prev = null;
    this.tool = null;
  }
}
