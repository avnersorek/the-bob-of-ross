import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "../../scripts/screenshot.mjs"), "utf8");

describe("screenshot.mjs --setup ordering", () => {
  it("evaluates --setup before the simulated drags", () => {
    expect(source.indexOf("page.evaluate(opt.setup)")).toBeGreaterThan(-1);
    expect(source.indexOf("page.evaluate(opt.setup)")).toBeLessThan(source.indexOf("for (const [x1, y1, x2, y2] of opt.drags)"));
  });

  it("runs --eval after the simulated drags", () => {
    expect(source.indexOf("for (const [x1, y1, x2, y2] of opt.drags)")).toBeLessThan(source.indexOf("for (const code of opt.evals)"));
  });
});
