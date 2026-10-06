import { clamp } from "../util/math";
import type { ToolConfig } from "../data/script.schema";

export function flowOf(tool: ToolConfig): number {
  return clamp(tool.flow ?? 1, 0, 1);
}

export function applyStrokeStyle(ctx: CanvasRenderingContext2D, tool: ToolConfig): void {
  ctx.globalCompositeOperation = tool.blendMode;
  ctx.strokeStyle = tool.color;
  ctx.fillStyle = tool.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
