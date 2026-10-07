import { z } from "zod";

const TOOL_TYPES = ["liquid_white_base", "sky_wash", "pine_tree_foliage", "mountain_snow"] as const;

const BLEND_MODES = ["source-over", "multiply", "screen", "lighter"] as const;

export const toolConfigSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color"),
  type: z.enum(TOOL_TYPES),
  opacity: z.number().min(0).max(1),
  size: z.number().positive().max(500),
  blendMode: z.enum(BLEND_MODES),
  breakTexture: z.boolean().optional(),
  spacing: z.number().positive().max(500).optional(),
  flow: z.number().min(0).max(1).optional(),
});

export const segmentSchema = z
  .object({
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    tool: toolConfigSchema,
    bobDialogue: z.string().optional(),
  })
  .refine((s) => s.endTime > s.startTime, {
    message: "endTime must be greater than startTime",
    path: ["endTime"],
  });

export const toolScriptSchema = z
  .object({
    videoId: z.string().min(1),
    title: z.string().min(1),
    timeline: z.array(segmentSchema).min(1),
    version: z.number().positive().optional(),
  })
  .refine(
    (s) => {
      for (let i = 1; i < s.timeline.length; i++) {
        if (s.timeline[i]!.startTime < s.timeline[i - 1]!.endTime) {
          return false;
        }
      }
      return true;
    },
    { message: "timeline segments must be ordered and non-overlapping" }
  );

export type ToolType = (typeof TOOL_TYPES)[number];
export type BlendMode = (typeof BLEND_MODES)[number];
export type ToolConfig = z.infer<typeof toolConfigSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type ToolScript = z.infer<typeof toolScriptSchema>;
