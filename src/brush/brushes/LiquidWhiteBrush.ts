import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { applyStrokeStyle } from "../brushCommon";
import {
  REF_CANVAS_WIDTH,
  footprintFor,
  profileFor,
  strokeAlpha,
  velocityWidth,
  type ToolProfile,
} from "../toolProfile";
import { getSoftSprite } from "../sprites";
import { noise1D } from "../../util/math";

/**
 * liquid_white_base — the big prep brush (transcript 2:11 "cover the canvas
 * with a thin layer of magic white", 2:59 "long strokes back and forth").
 *
 * Footprint is very large (profile × canvas scale), alpha is very low, and the
 * stamp is a wide flat ellipse swept in a criss-cross so a slow drag lays a
 * broad, even, translucent coat that builds with repeated passes.
 */
export class LiquidWhiteBrush implements Brush {
  private tool: ToolConfig | null = null;
  private profile: ToolProfile | null = null;
  private radius = 0;
  private alpha = 0;
  private widthFactor = 1;
  private arc = 0;

  prepare(tool: ToolConfig): void {
    if (tool.opacity === 0) return;
    getSoftSprite(tool.color, footprintFor(tool, REF_CANVAS_WIDTH) / 2, profileFor(tool).falloff);
  }

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    const { tool, pos, vel } = context;
    if (tool.opacity === 0) return;
    this.tool = tool;
    this.profile = profileFor(tool);
    this.radius = footprintFor(tool, ctx.canvas.width) / 2;
    this.alpha = strokeAlpha(this.profile, tool, vel);
    this.widthFactor = velocityWidth(this.profile, vel);
    this.arc = 0;
    applyStrokeStyle(ctx, tool);
    this.stamp(ctx, pos.x, pos.y, 0, this.alpha, this.widthFactor);
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    const tool = this.tool;
    const profile = this.profile;
    if (!tool || !profile) return;
    for (const p of points) {
      const arc = p.arcLen ?? this.arc;
      const theta = (p.angle ?? 0) + 0.7 * Math.sin(arc / Math.max(1, this.radius * 0.35));
      this.stamp(
        ctx,
        p.x,
        p.y,
        theta,
        strokeAlpha(profile, tool, p.vel ?? 0),
        velocityWidth(profile, p.vel ?? 0)
      );
      this.arc = arc;
    }
  }

  private stamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    theta: number,
    alpha: number,
    widthFactor: number
  ): void {
    const sprite = getSoftSprite(this.tool!.color, this.radius, this.profile!.falloff);
    const jitter = this.radius * 0.12 * noise1D(this.arc * 0.02);
    const perp = theta + Math.PI / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + Math.cos(perp) * jitter, y + Math.sin(perp) * jitter);
    ctx.rotate(theta);
    ctx.scale(1, 0.58 * widthFactor);
    ctx.drawImage(sprite, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    ctx.restore();
  }

  endStroke(): void {
    this.tool = null;
    this.profile = null;
  }
}
