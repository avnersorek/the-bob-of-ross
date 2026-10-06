export class Compositor {
  private base: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;
  private initialized = false;

  constructor() {
    this.base = document.createElement("canvas");
    this.baseCtx = this.base.getContext("2d")!;
  }

  get width(): number {
    return this.base.width;
  }

  get height(): number {
    return this.base.height;
  }

  ensureSize(cssW: number, cssH: number, dpr: number): void {
    const w = Math.max(2, Math.round(cssW * dpr));
    const h = Math.max(2, Math.round(cssH * dpr));
    if (w === this.base.width && h === this.base.height) return;
    const old = this.base.width > 0 ? document.createElement("canvas") : null;
    if (old) {
      old.width = this.base.width;
      old.height = this.base.height;
      old.getContext("2d")!.drawImage(this.base, 0, 0);
    }
    this.base.width = w;
    this.base.height = h;
    this.baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    if (old && old.width > 0) {
      this.baseCtx.drawImage(old, 0, 0);
    }
    this.initialized = true;
  }

  get needsInitialFill(): boolean {
    return !this.initialized;
  }

  getContext(): CanvasRenderingContext2D {
    return this.baseCtx;
  }

  getCanvas(): HTMLCanvasElement {
    return this.base;
  }

  fillBg(color: string): void {
    this.baseCtx.save();
    this.baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.baseCtx.globalCompositeOperation = "source-over";
    this.baseCtx.fillStyle = color;
    this.baseCtx.fillRect(0, 0, this.base.width, this.base.height);
    this.baseCtx.restore();
  }

  blit(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.base, 0, 0);
  }

  toDataURL(type = "image/png"): string {
    return this.base.toDataURL(type);
  }
}
