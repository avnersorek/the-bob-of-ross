import { describe, expect, it } from "vitest";
import { toolConfigSchema } from "./script.schema";

const base = {
  name: "Brush",
  color: "#FFFFFF",
  type: "sky_wash",
  opacity: 0.5,
  size: 24,
  blendMode: "source-over",
};

describe("toolConfigSchema bounds", () => {
  it("rejects an unbounded size", () => {
    expect(toolConfigSchema.safeParse({ ...base, size: 1e9 }).success).toBe(false);
  });
  it("rejects an unbounded spacing", () => {
    expect(toolConfigSchema.safeParse({ ...base, spacing: 1e9 }).success).toBe(false);
  });
  it("accepts a reasonable config", () => {
    expect(toolConfigSchema.safeParse(base).success).toBe(true);
  });
});
