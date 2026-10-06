import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { flowOf, applyStrokeStyle } from "../brushCommon";
import {
  footprintFor,
  profileFor,
  profileNameFor,
  strokeAlpha,
  velocityWidth,
  type ToolProfile,
} from "../toolProfile";
import { clamp, lerp, mulberry32, randRange } from "../../util/math";

type KnifeStyle = "line" | "broad" | "cut";

/**
 * mountain_snow — the palette-knife family (plan §6.6). Three behaviours come
 * out of the central table:
 *
 *  - **broad** (`knife_broad`, breakTexture + size >= 12): transcript 14:50
 *    "take the knife and let this path sort of just wander" → a broad,
 *    semi-opaque scraped band with breaking flecks.
 *  - **cut** (`knife_cut`, breakTexture + size < 12): 20:56 "a thin white
 *    paint and you literally just cut right into the canvas", 21:14 "cut a few
 *    little sticks" → a thin, crisp, hard-edged line that breaks into gaps as
 *    the pointer speeds up.
 *  - **line** (`knife_line`, breakTexture false): the script-liner signature →
 *    one crisp continuous stroke, never broken.
 *
 * Blend mode always comes from the script (`screen` for sheen/water lines,
 * `source-over` for brown path/puddles/signature).
 */
export class MountainSnowBrush implements Brush {
  private tool: ToolConfig | null = null;
  private profile: ToolProfile | null = null;
  private style: KnifeStyle = "line";
  private footprint = 0;
  private prev: Point | null = null;
  private arc = 0;
  private sampleIndex = 0;
  private seedBase = 0;
  private gap = 0;

  prepare(_tool: ToolConfig): void {}

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    const { tool, pos, seed } = context;
    if (tool.opacity === 0) return;
    this.tool = tool;
    this.profile = profileFor(tool);
    const name = profileNameFor(tool);
    this.style = name === "knife_line" ? "line" : name === "knife_broad" ? "broad" : "cut";
    this.footprint = footprintFor(tool, ctx.canvas.width);
    this.sampleIndex = 0;
    this.prev = pos;
    this.arc = 0;
    this.gap = 0;
    this.seedBase = seed >>> 0;
    applyStrokeStyle(ctx, tool);
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    const tool = this.tool;
    if (!tool) return;
    for (const p of points) {
      if (this.style === "broad") this.broadSample(ctx, tool, p);
      else if (this.style === "cut") this.cutSample(ctx, tool, p);
      else this.solidSample(ctx, tool, p);
    }
  }

  private solidSample(ctx: CanvasRenderingContext2D, tool: ToolConfig, p: Point): void {
    const prev = this.prev;
    if (!prev) {
      this.prev = p;
      return;
    }
    const profile = this.profile as ToolProfile;
    const vel = p.vel ?? 0;
    ctx.save();
    ctx.globalAlpha = strokeAlpha(profile, tool, vel);
    ctx.lineWidth = Math.max(1, this.footprint * 0.7 * velocityWidth(profile, vel));
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    this.prev = p;
    this.arc = p.arcLen ?? this.arc;
    this.sampleIndex++;
  }

  /** Thin, crisp, hard-edged cut that breaks up as the hand moves faster. */
  private cutSample(ctx: CanvasRenderingContext2D, tool: ToolConfig, p: Point): void {
    const profile = this.profile as ToolProfile;
    const prev = this.prev;
    const vel = p.vel ?? 0;
    const rand = mulberry32((this.seedBase ^ (this.sampleIndex * 2654435761)) >>> 0);
    this.sampleIndex++;
    const dryness = clamp(vel / 60, 0, 1);
    const alpha = strokeAlpha(profile, tool, vel);
    const tangent = p.angle ?? 0;
    const breaking = this.gap > 0;
    if (breaking) this.gap--;

    if (prev && !breaking) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1, this.footprint * 0.2 * velocityWidth(profile, vel));
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (rand() < 0.4) {
        const nx = -Math.sin(tangent);
        const ny = Math.cos(tangent);
        const off = randRange(rand, -this.footprint * 0.35, this.footprint * 0.35);
        const bx = p.x + nx * off;
        const by = p.y + ny * off;
        const len = this.footprint * randRange(rand, 0.3, 0.9);
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = Math.max(1, this.footprint * 0.12);
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(tangent) * (len / 2), by - Math.sin(tangent) * (len / 2));
        ctx.lineTo(bx + Math.cos(tangent) * (len / 2), by + Math.sin(tangent) * (len / 2));
        ctx.stroke();
      }
      ctx.restore();
    }

    if (!breaking && rand() < 0.05 + 0.22 * dryness) {
      this.gap = 2 + Math.floor(rand() * 7);
    }
    this.prev = p;
    this.arc = p.arcLen ?? this.arc;
  }

  /** Broad semi-opaque scrape: soft body + broken flecks across the band. */
  private broadSample(ctx: CanvasRenderingContext2D, tool: ToolConfig, p: Point): void {
    const profile = this.profile as ToolProfile;
    const prev = this.prev;
    const vel = p.vel ?? 0;
    const rand = mulberry32((this.seedBase ^ (this.sampleIndex * 2654435761)) >>> 0);
    this.sampleIndex++;
    const dryness = clamp(vel / 60, 0, 1);
    const alpha = strokeAlpha(profile, tool, vel);
    const flow = flowOf(tool);
    const tangent = p.angle ?? 0;
    const nx = -Math.sin(tangent);
    const ny = Math.cos(tangent);

    if (prev) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.35;
      ctx.lineWidth = Math.max(1, this.footprint * 0.55 * velocityWidth(profile, vel));
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }

    const halfW = (this.footprint / 2) * randRange(rand, 0.8, 1.05);
    const flecks = Math.round(lerp(4, 2, dryness));
    const dashLen = this.footprint * lerp(0.5, 0.2, dryness);
    ctx.save();
    ctx.lineWidth = Math.max(1, this.footprint * 0.1);
    for (let k = 0; k < flecks; k++) {
      if (rand() < 0.15 * (1 - flow) + 0.18 * dryness) continue;
      const off = randRange(rand, -halfW, halfW);
      const bx = p.x + nx * off;
      const by = p.y + ny * off;
      const len = dashLen * randRange(rand, 0.6, 1.4);
      const ang = tangent + randRange(rand, -0.18, 0.18);
      ctx.globalAlpha = alpha * randRange(rand, 0.5, 1);
      ctx.beginPath();
      ctx.moveTo(bx - Math.cos(ang) * (len / 2), by - Math.sin(ang) * (len / 2));
      ctx.lineTo(bx + Math.cos(ang) * (len / 2), by + Math.sin(ang) * (len / 2));
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = tool.color;
    const speckle = mulberry32(((this.sampleIndex * 0x9e3779b9) ^ this.seedBase) >>> 0);
    const spread = this.footprint * 0.6;
    for (let sp = 0; sp < 3; sp++) {
      const a = speckle() * Math.PI * 2;
      const rr = spread * speckle();
      ctx.fillRect(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 1.5, 1.5);
    }
    ctx.restore();
    this.prev = p;
    this.arc = p.arcLen ?? this.arc;
  }

  endStroke(): void {
    this.prev = null;
    this.tool = null;
    this.profile = null;
  }
}
