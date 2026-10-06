import type { Brush, BrushContext, BrushEngine, Point } from "./Brush";
import type { ToolConfig } from "../data/script.schema";
import type { RenderTarget } from "../render/Renderer";
import { BrushFactory } from "./BrushFactory";
import { Stroke } from "./Stroke";
import { strokeSpacing } from "./brushCommon";

export type SpawnParticles = (x: number, y: number, color: string, count: number) => void;

export class PaintEngine implements BrushEngine, RenderTarget {
  hover: { x: number; y: number } | null = null;
  painted = false;
  private tool: ToolConfig | null = null;
  private paintTool: ToolConfig | null = null;
  private stroke: Stroke | null = null;
  private brush: Brush | null = null;
  private strokeTool: ToolConfig | null = null;
  private active = false;

  constructor(
    private factory: BrushFactory,
    private fallback: ToolConfig,
    private baseCtx: CanvasRenderingContext2D,
    private spawnParticlesAt?: SpawnParticles
  ) {}

  getPaintTool(): ToolConfig | null {
    return this.paintTool;
  }

  isActive(): boolean {
    return this.active;
  }

  private resolve(t: ToolConfig | null): ToolConfig | null {
    if (t && t.opacity > 0) return t;
    return this.fallback;
  }

  setTool(tool: ToolConfig | null): void {
    this.tool = tool;
    if (!this.active) {
      this.paintTool = this.resolve(tool);
    }
  }

  prepare(tool: ToolConfig): void {
    this.factory.forTool(tool).prepare(tool);
  }

  beginStroke(p: Point): void {
    if (this.active) this.endStroke();
    const tool = this.resolve(this.tool);
    if (!tool) return;
    this.paintTool = tool;
    this.strokeTool = tool;
    this.stroke = new Stroke(Math.floor(Math.random() * 0xffffffff));
    this.brush = this.factory.forTool(tool);
    this.active = true;
    this.baseCtx.save();
    this.brush.beginStroke(this.baseCtx, this.strokeContext(p, 0, tool));
    this.flush();
  }

  move(p: Point): void {
    if (!this.active) return;
    this.stroke?.add(p);
  }

  flush(): void {
    if (!this.active || !this.stroke || !this.brush || !this.strokeTool) return;
    const step = strokeSpacing(this.strokeTool);
    const samples = this.stroke.resample(step);
    if (samples.length === 0) {
      return;
    }
    this.brush.extendStroke(this.baseCtx, samples);
    this.painted = true;
    if (this.spawnParticlesAt) {
      const last = samples[samples.length - 1]!;
      this.spawnParticlesAt(last.x, last.y, this.strokeTool.color, Math.min(5, 2 + samples.length));
    }
  }

  endStroke(): void {
    if (!this.active) return;
    this.flush();
    this.baseCtx.restore();
    this.brush?.endStroke();
    this.active = false;
    this.stroke = null;
    this.brush = null;
    this.strokeTool = null;
  }

  clear(): void {
    if (this.active) {
      this.baseCtx.restore();
      this.active = false;
      this.stroke = null;
      this.brush = null;
      this.strokeTool = null;
    }
  }

  setHover(p: Point | null): void {
    this.hover = p;
  }

  private strokeContext(p: Point, vel: number, tool: ToolConfig): BrushContext {
    return { tool, pos: p, vel, seed: this.stroke!.seed };
  }
}
