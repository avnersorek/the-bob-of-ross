import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { flowOf, applyStrokeStyle } from "../brushCommon";
import {
  RIBBON_MAX_SIZE,
  footprintFor,
  profileFor,
  profileNameFor,
  strokeAlpha,
  velocityWidth,
  type ToolProfile,
} from "../toolProfile";
import { clamp, lerp, mulberry32, randRange } from "../../util/math";

export type PineMode = "cluster" | "ribbon";

/**
 * pine_tree_foliage — tree anatomy (plan §6.5). Two behaviours, selected from
 * the central profile table:
 *
 *  - **dab** (`pine_dab`, size >= 18): transcript 6:26 "just bend the brush …
 *    push in basic tree shapes", 6:33 "make those little leaves … pop right
 *    out", 10:40 "push thousands of little leaves, they hide in your brush".
 *    The brush *stamps* weak clusters at a loose spacing — accents, never a
 *    continuous ribbon — so a drag builds a mass out of many soft touches.
 *  - **line** (`pine_ribbon`, size < 18): 8:10 "lay in some basic trunks …
 *    little sticks and twigs" → a tapered ribbon with sprouting twigs.
 */
export class PineTreeBrush implements Brush {
  mode: PineMode = "cluster";
  private tool: ToolConfig | null = null;
  private profile: ToolProfile | null = null;
  private footprint = 0;
  private dabbing = false;
  private sampleIndex = 0;
  private prev: Point | null = null;
  private arc = 0;
  private lastTwigArc = 0;
  private seedBase = 0;

  prepare(_tool: ToolConfig): void {}

  static modeFor(size: number): PineMode {
    return size < RIBBON_MAX_SIZE ? "ribbon" : "cluster";
  }

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    const { tool, pos, vel, seed } = context;
    if (tool.opacity === 0) return;
    this.tool = tool;
    this.profile = profileFor(tool);
    this.dabbing = profileNameFor(tool) === "pine_dab";
    this.mode = this.dabbing ? "cluster" : "ribbon";
    this.footprint = footprintFor(tool, ctx.canvas.width);
    this.sampleIndex = 0;
    this.prev = null;
    this.arc = 0;
    this.lastTwigArc = 0;
    this.seedBase = seed >>> 0;
    applyStrokeStyle(ctx, tool);
    if (this.dabbing) {
      this.stampCluster(ctx, pos.x, pos.y, -Math.PI / 2, vel);
    }
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    if (!this.tool || !this.profile) return;
    if (this.dabbing) {
      for (const p of points) {
        if ((p.arcLen ?? 0) === 0) continue; // beginStroke already placed one
        this.stampCluster(ctx, p.x, p.y, p.angle ?? -Math.PI / 2, p.vel ?? 0);
      }
    } else {
      for (const p of points) {
        this.ribbonSample(ctx, p);
      }
    }
  }

  /** One weak accent: a small scatter of leaf marks, never a solid blob. */
  private stampCluster(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    axis: number,
    vel: number
  ): void {
    const tool = this.tool!;
    const profile = this.profile!;
    const size = this.footprint;
    const rand = mulberry32((this.seedBase ^ (this.sampleIndex * 2654435761)) >>> 0);
    this.sampleIndex++;
    // Varied spacing: some taps leave no mark at all → scattered accents.
    if (rand() < 0.16) return;

    const alpha = strokeAlpha(profile, tool, vel);
    const n = Math.round(lerp(9, 15, clamp(size / 90, 0, 1)));
    const perp = axis + Math.PI / 2;
    const scatter = size * 0.34 * (rand() - 0.5) * 2;
    const fan = axis + (rand() - 0.5) * 0.8;
    const cx = x + Math.cos(perp) * scatter;
    const cy = y + Math.sin(perp) * scatter;
    const blob = size * 0.36;
    const width = Math.max(1, size * 0.035);

    for (let k = 0; k < n; k++) {
      const seedAngle = rand() * Math.PI * 2;
      const seedRadius = blob * Math.sqrt(rand());
      const ox = cx + Math.cos(seedAngle) * seedRadius;
      const oy = cy + Math.sin(seedAngle) * seedRadius;
      const dir = fan + (rand() - 0.5) * 1.8;
      const len = size * randRange(rand, 0.16, 0.36);
      ctx.save();
      ctx.globalAlpha = alpha * randRange(rand, 0.55, 1);
      ctx.lineWidth = width * randRange(rand, 0.8, 1.3);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(dir) * len, oy + Math.sin(dir) * len);
      ctx.stroke();
      ctx.restore();
    }
  }

  private ribbonSample(ctx: CanvasRenderingContext2D, p: Point): void {
    const tool = this.tool!;
    const profile = this.profile!;
    if (!this.prev) {
      this.prev = p;
      return;
    }
    const flow = flowOf(tool);
    const arc = p.arcLen ?? this.arc;
    const taper = lerp(1, 0.5, clamp(arc / Math.max(1, this.footprint * 5), 0, 1));
    ctx.save();
    ctx.globalAlpha = strokeAlpha(profile, tool, p.vel ?? 0);
    ctx.lineWidth = Math.max(
      1,
      this.footprint * taper * (0.7 + 0.3 * flow) * velocityWidth(profile, p.vel ?? 0)
    );
    ctx.beginPath();
    ctx.moveTo(this.prev.x, this.prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    if (arc - this.lastTwigArc >= this.footprint * 1.6) {
      this.lastTwigArc = arc;
      this.drawTwigs(ctx, p, tool, profile);
    }
    this.prev = p;
    this.arc = arc;
  }

  private drawTwigs(
    ctx: CanvasRenderingContext2D,
    p: Point,
    tool: ToolConfig,
    profile: ToolProfile
  ): void {
    const r = mulberry32(((this.sampleIndex * 0x85ebca6b) ^ 0xc2b2ae35) >>> 0);
    const base = p.angle ?? 0;
    ctx.save();
    ctx.globalAlpha = strokeAlpha(profile, tool, p.vel ?? 0);
    ctx.lineWidth = Math.max(1, this.footprint * 0.18);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const ang = base + side * randRange(r, 0.5, 1.1);
      const len = this.footprint * randRange(r, 0.35, 0.8);
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
    this.profile = null;
  }
}
