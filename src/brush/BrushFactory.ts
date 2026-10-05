import type { ToolConfig, ToolType } from "../data/script.schema";
import type { Brush } from "./Brush";
import { LiquidWhiteBrush } from "./brushes/LiquidWhiteBrush";
import { SkyWashBrush } from "./brushes/SkyWashBrush";
import { PineTreeBrush } from "./brushes/PineTreeBrush";
import { MountainSnowBrush } from "./brushes/MountainSnowBrush";

export class BrushFactory {
  private brushes = new Map<ToolType, Brush>();

  constructor() {
    this.brushes.set("liquid_white_base", new LiquidWhiteBrush());
    this.brushes.set("sky_wash", new SkyWashBrush());
    this.brushes.set("pine_tree_foliage", new PineTreeBrush());
    this.brushes.set("mountain_snow", new MountainSnowBrush());
  }

  forTool(tool: ToolConfig): Brush {
    const brush = this.brushes.get(tool.type);
    if (!brush) {
      return this.brushes.get("liquid_white_base")!;
    }
    return brush;
  }
}