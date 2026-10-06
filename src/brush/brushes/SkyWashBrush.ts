import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";
import { flowOf, applyStrokeStyle } from "../brushCommon";
import { getSoftSprite } from "../sprites";
import { clamp } from "../../util/math";

const V_REF = 8;

export class SkyWashBrush implements Brush {
  private tool: ToolConfig | null = null;
  private radius = 0;

  prepare(tool: ToolConfig): void {
    if (tool.opacity === 0) return;
    getSoftSprite(tool.color, tool.size * 0.7, "gaussian");
  }

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    const { tool, pos } = context;
    if (tool.opacity === 0) return;
    this.tool = tool;
    this.radius = tool.size * 0.7;
    applyStrokeStyle(ctx, tool);
    const alpha = tool.opacity * flowOf(tool) * 1;
    this.stamp(ctx, pos.x, pos.y, 0, alpha, 0);
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    const tool = this.tool;
    if (!tool) return;
    for (const p of points) {
      const v = p.vel ?? 0;
      const density = clamp(1 - (v / V_REF) * 0.6, 0.2, 1);
      const alpha = tool.opacity * flowOf(tool) * density;
      this.stamp(ctx, p.x, p.y, p.angle ?? 0, alpha, p.arcLen ?? 0);
    }
  }

  private stamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    theta: number,
    alpha: number,
    arc: number
  ): void {
    const sprite = getSoftSprite(this.tool!.color, this.radius, "gaussian");
    const wobble = Math.sin(arc * 0.08) * 0.12;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(theta + wobble);
    ctx.scale(1.35, 0.82);
    ctx.drawImage(sprite, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    ctx.restore();
  }

  endStroke(): void {
    this.tool = null;
  }
}
