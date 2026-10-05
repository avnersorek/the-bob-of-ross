export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private baseCanvas: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.baseCanvas = document.createElement("canvas");
    this.baseCtx = this.baseCanvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  getBaseContext(): CanvasRenderingContext2D {
    return this.baseCtx;
  }

  getVisibleContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getBaseCanvas(): HTMLCanvasElement {
    return this.baseCanvas;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth * 0.85;
    const cssH = window.innerHeight * 0.85;
    this.width = cssW;
    this.height = cssH;
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    this.canvas.width = cssW * this.dpr;
    this.canvas.height = cssH * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    this.baseCanvas.width = cssW * this.dpr;
    this.baseCanvas.height = cssH * this.dpr;
    this.baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.baseCtx.scale(this.dpr, this.dpr);
  }

  render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(this.baseCanvas, 0, 0, this.width, this.height);
  }

  clear(): void {
    this.baseCtx.clearRect(0, 0, this.width, this.height);
  }
}