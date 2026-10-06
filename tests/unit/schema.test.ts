import { describe, it, expect } from "vitest";
import { toolScriptSchema } from "../../src/data/script.schema";
import validScript from "../fixtures/valid.script.json";
import invalidScript from "../fixtures/invalid.script.json";

describe("schema", () => {
  it("validates valid script", () => {
    const result = toolScriptSchema.safeParse(validScript);
    expect(result.success).toBe(true);
  });

  it("rejects invalid script", () => {
    const result = toolScriptSchema.safeParse(invalidScript);
    expect(result.success).toBe(false);
  });
});
