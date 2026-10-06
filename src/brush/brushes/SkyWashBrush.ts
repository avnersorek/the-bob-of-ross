import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { flowOf, applyStrokeStyle } from "../brushCommon";
import {
  REF_CANVAS_WIDTH,
  footprintFor,
  profileFor,
  strokeAlpha,
  velocityWidth,
  type ToolProfile,
} from "../toolProfile";
import { getSoftSprite } from "../sprites";

/**
 * sky_wash — the wide soft wash (transcript 3:55 "begin making little X's",
 * 4:20 "making the crisscross strokes, little X strokes", 17:29 "pull
 * downward").
 *
 * A single stamp is a big gaussian ellipse rotated alternately either side of
 * the direction of travel, so a drag paints overlapping X's rather than one
 * thin line; alpha is low-to-moderate and drops further with pointer speed,
 * which is what makes the 17:29 downward pull read as a soft streak.
 */
export class SkyWashBrush implements Brush {
  private tool: ToolConfig | null = null;
  private profile: ToolProfile | null = null;
  private radius = 0;
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
    this.arc = 0;
    applyStrokeStyle(ctx, tool);
    this.stamp(
      ctx,
      pos.x,
      pos.y,
      pos.angle ?? 0,
      this.alphaFor(tool, this.profile, vel),
      velocityWidth(this.profile, vel)
    );
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    const tool = this.tool;
    const profile = this.profile;
    if (!tool || !profile) return;
    for (const p of points) {
      const arc = p.arcLen ?? this.arc;
      const theta = (p.angle ?? 0) + this.crossTilt(arc);
      this.stamp(
        ctx,
        p.x,
        p.y,
        theta,
        this.alphaFor(tool, profile, p.vel ?? 0),
        velocityWidth(profile, p.vel ?? 0)
      );
      this.arc = arc;
    }
  }

  private alphaFor(tool: ToolConfig, profile: ToolProfile, vel: number): number {
    return strokeAlpha(profile, tool, vel) * flowOf(tool);
  }

  /** Alternating tilt → Bob's "little X's" instead of a single flat band. */
  private crossTilt(arc: number): number {
    const period = Math.max(1, this.radius * 2);
    return 0.5 * Math.sign(Math.sin((arc / period) * Math.PI * 2));
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
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(theta);
    ctx.scale(1, 0.62 * widthFactor);
    ctx.drawImage(sprite, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    ctx.restore();
  }

  endStroke(): void {
    this.tool = null;
    this.profile = null;
  }
}
