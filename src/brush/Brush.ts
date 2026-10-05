import type { ToolConfig } from "../data/script.schema";

export interface Point {
  x: number;
  y: number;
  time?: number;
  pressure?: number;
}

export interface BrushContext {
  tool: ToolConfig;
  pos: Point;
  vel: number;
}

export interface Brush {
  beginStroke(ctx: CanvasRenderingContext2D, context: BrushContext): void;
  extendStroke(ctx: CanvasRenderingContext2D, points: Point[]): void;
  endStroke(): void;
  prepare(tool: ToolConfig): void;
}

export interface BrushEngine {
  beginStroke(p: Point): void;
  move(p: Point): void;
  endStroke(): void;
  clear(): void;
  setTool(tool: ToolConfig | null): void;
  prepare(tool: ToolConfig): void;
}