/**
 * toolProfile.ts — THE single tuning table for "what a scripted tool actually
 * does on the canvas". Every brush reads its footprint, alpha, stamp spacing
 * and interaction mode from here; nothing is hard-coded in a brush anymore.
 *
 * Mapping is transcript-driven (docs/bob-transcript-s01e01.txt) and follows
 * plan §6, with the owner's fidelity overrides:
 *   (a) big brushes are BIG — `sizeMultiplier` × a canvas-relative scale, so a
 *       2-inch brush covers a genuinely wide swath of the canvas;
 *   (b) most Bob actions are ACCENTS (dabs / taps / cuts), not continuous
 *       lines — they paint weak (`opacityScale`) and build up on repetition.
 *
 * | profile      | transcript anchor (s01e01)                       | mode | ×size | ×alpha | step  |
 * |--------------|--------------------------------------------------|------|-------|--------|-------|
 * | liquid_white | 2:11 "cover the canvas with a thin layer of magic |
 * |              | white", 2:59 "long strokes back and forth"       | line | 3.2   | 1.00   | 0.16  |
 * | sky_wash     | 3:55 "making little X's", 4:20 "crisscross       |
 * |              | strokes", 17:29 "pull downward"                   | line | 3.0   | 0.70   | 0.20  |
 * | pine_dab     | 6:26 "bend the brush … push in basic tree shapes",
 * |              | 10:40 "push thousands of little leaves"           | dab  | 2.0   | 0.50   | 0.55  |
 * | pine_ribbon  | 8:10 "lay in some basic trunks … sticks and twigs"| line | 1.5   | 1.00   | 0.20  |
 * | knife_broad  | 14:50 "let this path sort of just wander"        | cut  | 1.6   | 0.80   | 0.14  |
 * | knife_cut    | 20:56 "literally just cut right into the canvas"  | cut  | 1.6   | 0.90   | 0.10  |
 * | knife_line   | 26:56 signature (script liner, crisp line)       | line | 1.6   | 1.00   | 0.12  |
 *
 * `step` is the stamp spacing as a fraction of the effective footprint:
 * line modes overlap (smooth coverage), dab mode spaces accents apart so a
 * drag reads as many soft touches instead of one solid ribbon.
 */
import type { ToolConfig } from "../data/script.schema";
import type { Falloff } from "./sprites";
import { clamp } from "../util/math";

export type StrokeMode = "line" | "dab" | "cut";

export interface ToolProfile {
  /** line = continuous stroke, dab = spaced stamps, cut = knife scrape. */
  mode: StrokeMode;
  /** Multiplier on the scripted `size` → on-canvas footprint width (px). */
  sizeMultiplier: number;
  /** Multiplier on the scripted `opacity` → per-stamp alpha (weak accents). */
  opacityScale: number;
  /** Stamp step as a fraction of the effective footprint. */
  spacing: number;
  /** How strongly faster pointer motion lightens the paint (0 = never). */
  velocityInfluence: number;
  /** Floor for the velocity factor (fast motion never disappears entirely). */
  minVelocityFactor: number;
  /** Radial falloff for sprite-based (soft) brushes. */
  falloff: Falloff;
}

/** Script `size` below this uses the trunk/limb ribbon instead of dabs (§6.5). */
export const RIBBON_MAX_SIZE = 18;
/** Knife `size` at/above this scrapes a broad band; below it, a thin cut. */
export const CUT_BROAD_MIN_SIZE = 12;
/** Canvas width (device px) that a scripted `size` was authored against. */
export const REF_CANVAS_WIDTH = 1000;
/** Pointer speed (device px / frame) at which velocity lightening bites. */
export const VEL_REF = 45;

const PROFILES = {
  liquid_white: {
    mode: "line",
    sizeMultiplier: 3.2,
    opacityScale: 1,
    spacing: 0.16,
    velocityInfluence: 0.45,
    minVelocityFactor: 0.5,
    falloff: "smooth",
  },
  sky_wash: {
    mode: "line",
    sizeMultiplier: 3,
    opacityScale: 0.7,
    spacing: 0.2,
    velocityInfluence: 0.6,
    minVelocityFactor: 0.3,
    falloff: "gaussian",
  },
  pine_dab: {
    mode: "dab",
    sizeMultiplier: 2,
    opacityScale: 0.5,
    spacing: 0.55,
    velocityInfluence: 0.5,
    minVelocityFactor: 0.35,
    falloff: "gaussian",
  },
  pine_ribbon: {
    mode: "line",
    sizeMultiplier: 1.5,
    opacityScale: 1,
    spacing: 0.2,
    velocityInfluence: 0.35,
    minVelocityFactor: 0.55,
    falloff: "smooth",
  },
  knife_broad: {
    mode: "cut",
    sizeMultiplier: 1.6,
    opacityScale: 0.8,
    spacing: 0.14,
    velocityInfluence: 0.5,
    minVelocityFactor: 0.35,
    falloff: "smooth",
  },
  knife_cut: {
    mode: "cut",
    sizeMultiplier: 1.6,
    opacityScale: 0.9,
    spacing: 0.1,
    velocityInfluence: 0.45,
    minVelocityFactor: 0.4,
    falloff: "smooth",
  },
  knife_line: {
    mode: "line",
    sizeMultiplier: 1.6,
    opacityScale: 1,
    spacing: 0.12,
    velocityInfluence: 0.3,
    minVelocityFactor: 0.6,
    falloff: "smooth",
  },
} as const satisfies Record<string, ToolProfile>;

export type ProfileName = keyof typeof PROFILES;

/**
 * Resolve the profile *name* for a scripted tool. The only branching in the
 * whole mapping lives here: foliage switches on `size` (§6.5), the knife
 * switches on `breakTexture` and `size` (§6.6). Everything else is a lookup.
 */
export function profileNameFor(tool: ToolConfig): ProfileName {
  switch (tool.type) {
    case "pine_tree_foliage":
      return tool.size < RIBBON_MAX_SIZE ? "pine_ribbon" : "pine_dab";
    case "mountain_snow":
      if (tool.breakTexture === false) return "knife_line";
      return tool.size >= CUT_BROAD_MIN_SIZE ? "knife_broad" : "knife_cut";
    case "sky_wash":
      return "sky_wash";
    default:
      return "liquid_white";
  }
}

/** The profile a tool paints with — see `profileNameFor` for the branching. */
export function profileFor(tool: ToolConfig): ToolProfile {
  return PROFILES[profileNameFor(tool)];
}

/** Canvas-relative scale: authored sizes feel the same on any canvas size. */
export function canvasScale(canvasWidth: number): number {
  return clamp(canvasWidth / REF_CANVAS_WIDTH, 0.8, 1.8);
}

/**
 * On-canvas width of the brush footprint in device px. This — not `tool.size`
 * — is what the user sees: a 2-inch brush on a 1360 px canvas is ~200 px wide.
 */
export function footprintFor(tool: ToolConfig, canvasWidth: number): number {
  return Math.max(2, tool.size * profileFor(tool).sizeMultiplier * canvasScale(canvasWidth));
}

/** Fast motion lays less paint; slow/tap motion lays it on (§6.4 speed rule). */
export function velocityFactor(profile: ToolProfile, vel: number): number {
  if (!Number.isFinite(vel) || vel <= 0) return 1;
  return clamp(1 - profile.velocityInfluence * (vel / VEL_REF), profile.minVelocityFactor, 1);
}

/** Fast motion is also *thinner* — scales stroke width, not just alpha. */
export function velocityWidth(profile: ToolProfile, vel: number): number {
  return 0.65 + 0.35 * velocityFactor(profile, vel);
}

/** Per-stamp alpha: scripted opacity × profile strength × velocity lightening. */
export function strokeAlpha(profile: ToolProfile, tool: ToolConfig, vel: number): number {
  return clamp(tool.opacity * profile.opacityScale * velocityFactor(profile, vel), 0, 1);
}

/**
 * Distance between stamps along the path (device px). Scripted `spacing`
 * (§6.2) only nudges the profile value, so the table stays authoritative.
 */
export function strokeStepFor(tool: ToolConfig, canvasWidth: number): number {
  const profile = profileFor(tool);
  const footprint = footprintFor(tool, canvasWidth);
  const hint = tool.spacing ? clamp(tool.spacing / 0.35, 0.7, 1.6) : 1;
  return Math.max(1, footprint * profile.spacing * hint);
}
