import { describe, it, expect, vi, afterEach } from "vitest";
import { Compositor } from "./compositor";

function makeCanvas() {
  const ctx = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: "",
    globalCompositeOperation: "",
  };
  return { width: 300, height: 150, getContext: () => ctx, _ctx: ctx };
}

describe("Compositor.ensureSize", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refills background and rescales old paint to the new size", () => {
    const canvases: ReturnType<typeof makeCanvas>[] = [];
    vi.stubGlobal("document", {
      createElement: () => {
        const c = makeCanvas();
        canvases.push(c);
        return c;
      },
    });
    const comp = new Compositor();
    comp.ensureSize(100, 50, 1, "#e9e4d8");
    const base = canvases[0]!;
    const temp = canvases[1]!;
    expect(base.width).toBe(100);
    expect(base.height).toBe(50);
    expect(base._ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 50);
    expect(base._ctx.drawImage).toHaveBeenCalledWith(temp, 0, 0, 100, 50);
  });

  it("is a no-op when size is unchanged", () => {
    vi.stubGlobal("document", { createElement: () => makeCanvas() });
    const comp = new Compositor();
    comp.ensureSize(300, 150, 1);
    expect(comp.needsInitialFill).toBe(true);
  });
});
