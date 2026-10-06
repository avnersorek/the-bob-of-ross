import { clamp } from "../util/math";
import type { ToolConfig, ToolType } from "../data/script.schema";

const DEFAULT_SPACING: Record<ToolType, number> = {
  liquid_white_base: 0.25,
  sky_wash: 0.25,
  pine_tree_foliage: 0.35,
  mountain_snow: 0.3,
};

export function flowOf(tool: ToolConfig): number {
  return clamp(tool.flow ?? 1, 0, 1);
}

export function strokeSpacing(tool: ToolConfig): number {
  if (tool.type === "mountain_snow") {
    const flow = flowOf(tool);
    return Math.max(0.5, tool.size * (0.35 - 0.2 * flow));
  }
  const factor = tool.spacing ?? DEFAULT_SPACING[tool.type];
  return Math.max(0.5, tool.size * factor);
}

export function applyStrokeStyle(ctx: CanvasRenderingContext2D, tool: ToolConfig): void {
  ctx.globalCompositeOperation = tool.blendMode;
  ctx.strokeStyle = tool.color;
  ctx.fillStyle = tool.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
