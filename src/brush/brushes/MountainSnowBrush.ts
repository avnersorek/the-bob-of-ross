import type { Brush, BrushContext, Point } from "../Brush";
import type { ToolConfig } from "../../data/script.schema";

export class MountainSnowBrush implements Brush {
  prepare(_tool: ToolConfig): void {
    // no-op
  }

  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void {
    if (context.tool.opacity === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = context.tool.blendMode;
    ctx.globalAlpha = context.tool.opacity;
    ctx.strokeStyle = context.tool.color;
    ctx.lineWidth = Math.max(1, context.tool.size * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(context.pos.x, context.pos.y);
  }

  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  endStroke(): void {
    // no-op
  }
}