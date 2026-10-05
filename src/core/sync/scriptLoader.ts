import { toolScriptSchema, type ToolScript } from "../../data/script.schema";
import scriptData from "../../data/s01e01.json";

export function loadScript(): ToolScript {
  const result = toolScriptSchema.safeParse(scriptData);
  if (!result.success) {
    console.error("Script validation failed:", result.error);
    throw new Error("Invalid script data");
  }
  return result.data;
}