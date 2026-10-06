import { describe, it, expect } from "vitest";
import { loadScript } from "../../src/core/sync/scriptLoader";
import type { ToolConfig } from "../../src/data/script.schema";
import {
  CUT_BROAD_MIN_SIZE,
  RIBBON_MAX_SIZE,
  canvasScale,
  footprintFor,
  profileFor,
  profileNameFor,
  strokeAlpha,
  strokeStepFor,
  velocityFactor,
} from "../../src/brush/toolProfile";

function tool(partial: Partial<ToolConfig> = {}): ToolConfig {
  return {
    name: "Test tool",
    color: "#FF0000",
    type: "liquid_white_base",
    opacity: 1,
    size: 20,
    blendMode: "source-over",
    ...partial,
  };
}

const REF = 1000;
const WIDE = 1360; // the capture viewport's canvas width

describe("toolProfile — central tool → behaviour mapping", () => {
  it("maps every canonical segment to one of the three interaction modes", () => {
    const script = loadScript();
    const modes = script.timeline.map((s) => profileFor(s.tool).mode);
    for (const m of modes) expect(["line", "dab", "cut"]).toContain(m);
    // The scripted intent per plan §4.4 / §6:
    const byIndex = (i: number) => profileFor(script.timeline[i]!.tool).mode;
    expect(byIndex(1)).toBe("line"); // magic-white base coat
    expect(byIndex(3)).toBe("line"); // sky criss-cross wash
    expect(byIndex(5)).toBe("dab"); // "push in basic tree shapes" (size 25)
    expect(byIndex(6)).toBe("line"); // 1-inch trunk ribbon (size 12)
    expect(byIndex(8)).toBe("dab"); // "thousands of little leaves" (size 30)
    expect(byIndex(9)).toBe("cut"); // palette-knife path (size 15)
    expect(byIndex(14)).toBe("cut"); // "cut right into the canvas" (size 8)
    expect(byIndex(18)).toBe("line"); // script-liner signature (breakTexture false)
  });

  it("switches foliage between dab and ribbon on the plan's size threshold", () => {
    expect(profileNameFor(tool({ type: "pine_tree_foliage", size: RIBBON_MAX_SIZE }))).toBe(
      "pine_dab"
    );
    expect(profileNameFor(tool({ type: "pine_tree_foliage", size: RIBBON_MAX_SIZE - 1 }))).toBe(
      "pine_ribbon"
    );
  });

  it("switches the knife between broad scrape, thin cut and solid line", () => {
    expect(
      profileNameFor(tool({ type: "mountain_snow", size: CUT_BROAD_MIN_SIZE, breakTexture: true }))
    ).toBe("knife_broad");
    expect(
      profileNameFor(
        tool({ type: "mountain_snow", size: CUT_BROAD_MIN_SIZE - 1, breakTexture: true })
      )
    ).toBe("knife_cut");
    expect(profileNameFor(tool({ type: "mountain_snow", size: 4, breakTexture: false }))).toBe(
      "knife_line"
    );
  });
});

describe("toolProfile — footprints are scaled up and canvas-relative", () => {
  it("makes big brushes genuinely wide on a real canvas", () => {
    const twoInch = tool({ type: "sky_wash", size: 50 });
    const foot = footprintFor(twoInch, WIDE);
    expect(foot).toBeGreaterThanOrEqual(twoInch.size * 2.5);
    expect(foot / WIDE).toBeGreaterThan(0.1); // ≥10% of the canvas width
  });

  it("scales the footprint with the canvas", () => {
    const t = tool({ type: "liquid_white_base", size: 60 });
    expect(canvasScale(WIDE)).toBeGreaterThan(canvasScale(REF));
    expect(footprintFor(t, WIDE)).toBeGreaterThan(footprintFor(t, REF));
    expect(footprintFor(t, REF)).toBeCloseTo(60 * profileFor(t).sizeMultiplier, 5);
    expect(canvasScale(200)).toBeGreaterThanOrEqual(0.8);
    expect(canvasScale(4000)).toBeLessThanOrEqual(1.8);
  });

  it("gives each tool type a different footprint and stamp spacing", () => {
    const liquid = footprintFor(tool({ type: "liquid_white_base", size: 60 }), WIDE);
    const sky = footprintFor(tool({ type: "sky_wash", size: 50 }), WIDE);
    const dab = footprintFor(tool({ type: "pine_tree_foliage", size: 25 }), WIDE);
    const knife = footprintFor(tool({ type: "mountain_snow", size: 15 }), WIDE);
    expect(new Set([liquid, sky, dab, knife]).size).toBe(4);
  });

  it("spaces foliage dabs much further apart than line stamps", () => {
    const dabTool = tool({ type: "pine_tree_foliage", size: 30, spacing: 0.35 });
    const ribbonTool = tool({ type: "pine_tree_foliage", size: 12, spacing: 0.3 });
    const dabFoot = footprintFor(dabTool, WIDE);
    expect(strokeStepFor(dabTool, WIDE)).toBeGreaterThan(dabFoot * 0.4);
    expect(strokeStepFor(ribbonTool, WIDE)).toBeLessThan(footprintFor(ribbonTool, WIDE) * 0.35);
  });
});

describe("toolProfile — accents are weak and motion is lighter", () => {
  it("keeps per-stamp alpha well below the scripted opacity for accents", () => {
    const dab = tool({ type: "pine_tree_foliage", size: 30, opacity: 0.85 });
    const alpha = strokeAlpha(profileFor(dab), dab, 0);
    expect(alpha).toBeLessThanOrEqual(0.85 * 0.6);
    expect(alpha).toBeGreaterThan(0);
  });

  it("lightens paint as the pointer moves faster, down to a floor", () => {
    const sky = profileFor(tool({ type: "sky_wash", size: 50 }));
    const slow = velocityFactor(sky, 2);
    const fast = velocityFactor(sky, 60);
    const warp = velocityFactor(sky, 500);
    expect(slow).toBeGreaterThan(fast);
    expect(fast).toBeGreaterThanOrEqual(sky.minVelocityFactor);
    expect(warp).toBe(sky.minVelocityFactor);
    expect(velocityFactor(sky, -10)).toBe(1);
    expect(velocityFactor(sky, Number.NaN)).toBe(1);
  });

  it("scales alpha with the scripted opacity and blend stays data-driven", () => {
    const t = tool({ type: "sky_wash", size: 50, opacity: 0.4, blendMode: "multiply" });
    const full = strokeAlpha(profileFor(t), t, 0);
    expect(full).toBeLessThan(0.4 + 1e-9);
    expect(t.blendMode).toBe("multiply");
    expect(tool({ type: "mountain_snow", size: 12, breakTexture: true }).blendMode).toBe(
      "source-over"
    );
  });
});
