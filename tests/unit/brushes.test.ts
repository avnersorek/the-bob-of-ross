// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import type { ToolConfig } from "../../src/data/script.schema";
import { BrushFactory } from "../../src/brush/BrushFactory";
import { PaintEngine } from "../../src/brush/BrushEngine";
import { cssXToDevice, cssYToDevice, toCanvasPoint } from "../../src/brush/pointer";
import type { Point } from "../../src/brush/Brush";

function makeTool(partial: Partial<ToolConfig> = {}): ToolConfig {
  return {
    name: "Test tool",
    color: "#FF0000",
    type: "liquid_white_base",
    opacity: 0.5,
    size: 10,
    blendMode: "source-over",
    ...partial,
  };
}

function makeCanvas(
  w = 200,
  h = 200
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function pixelAt(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): [number, number, number, number] {
  const ctx = canvas.getContext("2d")!;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0]!, d[1]!, d[2]!, d[3]!];
}

function countChanged(canvas: HTMLCanvasElement, bg: [number, number, number, number]): number {
  const ctx = canvas.getContext("2d")!;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] !== bg[0] || d[i + 1] !== bg[1] || d[i + 2] !== bg[2]) n++;
  }
  return n;
}

const BG: [number, number, number, number] = [46, 51, 64, 255];

describe("brushes", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("liquid white stamps soft color onto the canvas", () => {
    const { canvas, ctx } = makeCanvas();
    ctx.fillStyle = "#2e3340";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const brush = new BrushFactory().forTool(makeTool());
    brush.beginStroke(ctx, { tool: makeTool(), pos: { x: 100, y: 100 }, vel: 0, seed: 1 });
    brush.endStroke();
    const [r, g, b] = pixelAt(canvas, 100, 100);
    expect(r).toBeGreaterThan(110);
    expect(r).toBeGreaterThan(g);
    expect(b).toBeLessThan(120);
  });

  it("multiply sky wash blends green into gray", () => {
    const { canvas, ctx } = makeCanvas();
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tool = makeTool({
      color: "#00FF00",
      type: "sky_wash",
      blendMode: "multiply",
      opacity: 0.7,
      size: 40,
      flow: 1,
    });
    const brush = new BrushFactory().forTool(tool);
    brush.beginStroke(ctx, { tool, pos: { x: 100, y: 100 }, vel: 0, seed: 2 });
    brush.endStroke();
    const [r, g, b] = pixelAt(canvas, 100, 100);
    expect(g).toBeGreaterThan(100);
    expect(r).toBeLessThan(110);
    expect(b).toBeLessThan(110);
  });

  it("pine foliage ribbon mode paints strokes", () => {
    const { canvas, ctx } = makeCanvas();
    ctx.fillStyle = "#2e3340";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tool = makeTool({ type: "pine_tree_foliage", size: 10, opacity: 0.7, color: "#5C2D4A" });
    const brush = new BrushFactory().forTool(tool);
    brush.beginStroke(ctx, { tool, pos: { x: 20, y: 20 }, vel: 5, seed: 3 });
    const pts: Point[] = [];
    for (let i = 1; i <= 10; i++) {
      pts.push({ x: 20 + i * 5, y: 20, arcLen: i * 5, angle: Math.PI / 2 });
    }
    brush.extendStroke(ctx, pts);
    brush.endStroke();
    expect(countChanged(canvas, BG)).toBeGreaterThan(0);
  });

  it("mountain snow solid mode paints tapered edge", () => {
    const { canvas, ctx } = makeCanvas();
    ctx.fillStyle = "#2e3340";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tool = makeTool({ type: "mountain_snow", size: 14, opacity: 0.5, color: "#FFFFFF" });
    const brush = new BrushFactory().forTool(tool);
    brush.beginStroke(ctx, { tool, pos: { x: 40, y: 100 }, vel: 4, seed: 4 });
    brush.extendStroke(ctx, [
      { x: 120, y: 100, arcLen: 80, angle: 0 },
      { x: 160, y: 100, arcLen: 120, angle: 0, vel: 4 },
    ]);
    brush.endStroke();
    expect(countChanged(canvas, BG)).toBeGreaterThan(0);
  });

  it("no-op when opacity is zero", () => {
    const { canvas, ctx } = makeCanvas();
    ctx.fillStyle = "#2e3340";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tool = makeTool({ opacity: 0 });
    const brush = new BrushFactory().forTool(tool);
    brush.beginStroke(ctx, { tool, pos: { x: 50, y: 50 }, vel: 0, seed: 5 });
    brush.endStroke();
    expect(countChanged(canvas, BG)).toBe(0);
  });
});

describe("PaintEngine", () => {
  function engineWithCanvas() {
    const { canvas, ctx } = makeCanvas();
    ctx.fillStyle = "#2e3340";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const fallback = makeTool({ opacity: 0.1, size: 30 });
    const engine = new PaintEngine(new BrushFactory(), fallback, ctx);
    return { canvas, ctx, engine, fallback };
  }

  it("resolves a paintable tool when the active tool is null", () => {
    const { engine, fallback } = engineWithCanvas();
    engine.setTool(null);
    expect(engine.getPaintTool()).toBe(fallback);
  });

  it("keeps a zero-opacity tool instead of substituting the fallback", () => {
    const { engine } = engineWithCanvas();
    const noPaint = makeTool({ opacity: 0 });
    engine.setTool(noPaint);
    expect(engine.getPaintTool()).toBe(noPaint);
  });

  it("does not paint when stroking with a zero-opacity tool", () => {
    const { canvas, engine } = engineWithCanvas();
    engine.setTool(makeTool({ size: 30, opacity: 0 }));
    engine.beginStroke({ x: 60, y: 100, time: 0 });
    for (let i = 1; i <= 12; i++) {
      engine.move({ x: 60 + i * 6, y: 100, time: i * 16.6667 });
    }
    engine.endStroke();
    expect(engine.painted).toBe(false);
    expect(countChanged(canvas, BG)).toBe(0);
  });

  it("keeps the scripted tool when it is paintable", () => {
    const { engine } = engineWithCanvas();
    const paint = makeTool({ opacity: 0.5 });
    engine.setTool(paint);
    expect(engine.getPaintTool()).toBe(paint);
  });

  it("paints a stroke and marks the canvas changed", () => {
    const { canvas, engine } = engineWithCanvas();
    engine.setTool(makeTool({ size: 20, opacity: 0.6 }));
    engine.beginStroke({ x: 60, y: 100, time: 0 });
    for (let i = 1; i <= 12; i++) {
      engine.move({ x: 60 + i * 6, y: 100, time: i * 16.6667 });
    }
    engine.endStroke();
    expect(engine.painted).toBe(true);
    expect(countChanged(canvas, BG)).toBeGreaterThan(0);
  });

  it("clears without painting more", () => {
    const { engine } = engineWithCanvas();
    engine.setTool(makeTool({ opacity: 0.6 }));
    engine.beginStroke({ x: 50, y: 50, time: 0 });
    engine.clear();
    expect(engine.isActive()).toBe(false);
  });
});

describe("pointer mapping", () => {
  it("maps CSS coordinates to device pixels via backing ratio", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1360;
    canvas.height = 900;
    Object.defineProperty(canvas, "clientWidth", { value: 680 });
    Object.defineProperty(canvas, "clientHeight", { value: 450 });
    expect(cssXToDevice(canvas, 340)).toBe(680);
    expect(cssYToDevice(canvas, 225)).toBe(450);
  });

  it("toCanvasPoint subtracts the border", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    Object.defineProperty(canvas, "clientWidth", { value: 96 });
    Object.defineProperty(canvas, "clientHeight", { value: 96 });
    canvas.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        width: 100,
        height: 100,
        right: 110,
        bottom: 120,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    canvas.style.borderLeftWidth = "2px";
    canvas.style.borderTopWidth = "2px";
    document.body.appendChild(canvas);
    const origGet = window.getComputedStyle.bind(window);
    window.getComputedStyle = (() => ({
      borderLeftWidth: "2px",
      borderTopWidth: "2px",
    })) as unknown as typeof window.getComputedStyle;
    try {
      const p = toCanvasPoint(canvas, { clientX: 60, clientY: 70, timeStamp: 0, pressure: 0.5 });
      expect(p.x).toBeCloseTo((60 - 10 - 2) * (100 / 96), 3);
      expect(p.y).toBeCloseTo((70 - 20 - 2) * (100 / 96), 3);
      expect(p.pressure).toBe(0.5);
    } finally {
      window.getComputedStyle = origGet;
    }
  });
});
