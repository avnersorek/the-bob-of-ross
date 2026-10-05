import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";

export class SkyWashBrush implements Brush {
  prepare(_tool: ToolConfig): void {
    // no-op
  }

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    if (context.tool.opacity === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = context.tool.blendMode;
    ctx.globalAlpha = context.tool.opacity;
    ctx.fillStyle = context.tool.color;
    const r = context.tool.size * 0.7;
    ctx.beginPath();
    ctx.arc(context.pos.x, context.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(10, (this as any).toolSize || 30) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  endStroke(): void {
    // no-op
  }
}