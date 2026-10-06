import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { flowOf, applyStrokeStyle } from "../brushCommon";
import { getSoftSprite } from "../sprites";
import { noise1D } from "../../util/math";

export class LiquidWhiteBrush implements Brush {
  private tool: ToolConfig | null = null;
  private radius = 0;
  private alpha = 0;
  private arc = 0;

  prepare(tool: ToolConfig): void {
    if (tool.opacity === 0) return;
    getSoftSprite(tool.color, tool.size / 2, "smooth");
  }

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    const { tool, pos } = context;
    if (tool.opacity === 0) return;
    this.tool = tool;
    this.radius = tool.size / 2;
    this.alpha = tool.opacity * (0.85 + 0.15 * flowOf(tool));
    this.arc = 0;
    applyStrokeStyle(ctx, tool);
    this.stamp(ctx, pos.x, pos.y, 0, 0);
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    const tool = this.tool;
    if (!tool) return;
    for (const p of points) {
      const theta = (p.angle ?? 0) + 0.7 * Math.sin(this.arc / tool.size);
      this.stamp(ctx, p.x, p.y, theta, p.arcLen ?? this.arc);
    }
  }

  private stamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    theta: number,
    arc: number
  ): void {
    const sprite = getSoftSprite(this.tool!.color, this.radius, "smooth");
    const jitter = this.radius * 0.16 * noise1D(arc * 0.05);
    const perp = theta + Math.PI / 2;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(x + Math.cos(perp) * jitter, y + Math.sin(perp) * jitter);
    ctx.rotate(theta);
    ctx.scale(1.7, 0.6);
    ctx.drawImage(sprite, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    ctx.restore();
    this.arc = arc;
  }

  endStroke(): void {
    this.tool = null;
  }
}
