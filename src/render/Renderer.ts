import type { ToolConfig } from "../data/script.schema";
import type { AppState } from "../core/state/AppState";
import { Compositor } from "./compositor";
import { CursorRenderer } from "./cursor";
import { ParticleSystem } from "./particles";

export interface RenderTarget {
  getPaintTool(): ToolConfig | null;
  hover: { x: number; y: number } | null;
  isActive(): boolean;
}

export class Renderer {
  static readonly CANVAS_BG = "#e9e4d8";
  private ctx: CanvasRenderingContext2D;
  private compositor = new Compositor();
  private cursor = new CursorRenderer();
  private particles = new ParticleSystem();
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private last = 0;
  private baseDirty = true;
  private hasRendered = false;
  private lastHoverKey = "";
  private lastParticleAt = -Infinity;
  private resizeRaf = 0;

  noteBaseDirty(): void {
    this.baseDirty = true;
  }

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.scheduleResize());
  }

  private scheduleResize(): void {
    if (this.resizeRaf !== 0) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.resize();
    });
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = window.innerWidth * 0.85;
    this.cssH = window.innerHeight * 0.85;
    this.canvas.style.width = `${Math.round(this.cssW)}px`;
    this.canvas.style.height = `${Math.round(this.cssH)}px`;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    const wasEmpty = this.compositor.needsInitialFill;
    this.compositor.ensureSize(this.cssW, this.cssH, this.dpr, Renderer.CANVAS_BG);
    this.baseDirty = true;
    if (wasEmpty) {
      this.compositor.fillBg(Renderer.CANVAS_BG);
    }
  }

  getBaseContext(): CanvasRenderingContext2D {
    return this.compositor.getContext();
  }

  getBaseCanvas(): HTMLCanvasElement {
    return this.compositor.getCanvas();
  }

  spawnParticles(x: number, y: number, color: string, count: number): void {
    this.particles.spawn(x, y, color, count);
    this.lastParticleAt = performance.now();
    this.last = this.lastParticleAt;
  }

  render(state: AppState, target: RenderTarget): void {
    const now = performance.now();
    const tool = target.getPaintTool() ?? state.activeTool;
    const hover = target.hover;
    const hoverKey = hover ? `${hover.x},${hover.y},${target.isActive()},${tool ? tool.color + tool.size : ""}` : "";
    const particlesLive = now - this.lastParticleAt < 2000;
    if (this.hasRendered && !this.baseDirty && !particlesLive && hoverKey === this.lastHoverKey) {
      return;
    }
    this.lastHoverKey = hoverKey;
    this.baseDirty = false;
    this.hasRendered = true;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.compositor.blit(this.ctx);
    if (this.last) {
      this.particles.update(now - this.last);
    }
    this.last = now;
    this.particles.render(this.ctx);

    if (hover && tool) {
      this.cursor.render(this.ctx, hover.x, hover.y, tool, target.isActive());
    }
  }

  clear(): void {
    this.compositor.fillBg(Renderer.CANVAS_BG);
    this.particles.clear();
    this.baseDirty = true;
    this.lastParticleAt = -Infinity;
  }

  toDataURL(type = "image/png"): string {
    return this.compositor.toDataURL(type);
  }
}
