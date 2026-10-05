# The Bob of Ross — Painting with Bob — MVP (Phase 1) Implementation Plan

> **Status:** Draft for implementation
> **Target:** MVP Phase 1 — a playable, synced, procedural painting experience
> **Source brief:** `docs/INITIAL_SPEC.md` (treated as product requirements only)

This document is the authoritative implementation plan for the MVP. It defines
scope boundaries, technology choices, file structure, data contracts, the
synchronization and brush engines, UI/state/performance architecture,
milestones, verification mapping, testing strategy, risks, and future phases.

---

## 1. Product / UX Recap & MVP Scope Boundaries

### 1.1 What we are building

An interactive web experience where the user paints alongside Bob Ross. A
floating YouTube window plays an episode of *The Joy of Painting*; a full-bleed
HTML5 canvas sits behind it. As the video advances, a timestamped JSON script
drives the active painting tool (brush name, color, type, size, opacity, blend
mode, and wet-on-wet behavior). The user simply clicks and drags on the canvas;
the engine procedurally generates strokes that mimic Bob's technique at that
moment. The result should feel effortless, "liquid," and relaxing.

### 1.2 Core UX requirements (from brief)

1. **Zen aesthetics** — minimalist, tranquil UI; dark/neutral room atmosphere;
   smooth 60 FPS canvas.
2. **Layout** — large canvas at ~80–85% of viewport; a small floating,
   draggable/dockable YouTube player overlay.
3. **Tool HUD** — a subtle translucent badge showing the active tool, e.g.
   `Tool: 2-inch Brush | Color: Phthalo Blue | Mode: Sky Wash`.
4. **Automation** — track `currentTime`, read the script, swap brush/color/size/
   wet-on-wet behavior every frame, without UI re-renders.
5. **Cursor feedback** — custom cursor per tool (wide rectangle for the 2-inch
   brush, fan shape, angled blade), plus subtle ripple/particle effects.

### 1.3 MVP scope — IN

- Single episode (`s01e01`, "A Walk in the Woods", YouTube ID `oh5p5f5_-7A`,
  https://www.youtube.com/watch?v=oh5p5f5_-7A).
- A hand-authored, validated timestamped tool script for that episode:
  `src/data/s01e01.json` — **19 contiguous segments spanning `0–1665 s`**, derived
  from the real transcript timings (§4.3–§4.4). Segment boundaries are the real
  `startTime` values `0, 131, 218, 252, 292, 368, 490, 555, 599, 881, 949, 1025,
  1081, 1125, 1233, 1306, 1409, 1456, 1616`; the last segment ends at `1665`.
- YouTube IFrame API player in a draggable floating window (play/pause/seek).
- Procedural brush engine on **Canvas2D** with four MVP tool types:
  `liquid_white_base`, `sky_wash`, `pine_tree_foliage`, `mountain_snow`.
- Bezier-interpolated pointer strokes, wet-on-wet layering, offscreen base
  layer, render loop decoupled from UI state.
- Control bar: Clear Canvas, Save PNG, Toggle sync/audio.
- Custom per-tool cursor + light particle/ripple feedback.
- Synchronization engine with segment lookahead and drift handling.
- Basic unit tests for the sync engine and the script schema.

### 1.4 MVP scope — OUT (explicitly deferred)

- WebGL shading, fluid simulation, and ultra-realistic brush physics (Phase 2+).
- Multiple episodes / community script library / script editor (Phase 3).
- Color mixing realism, palette management, undo history (single undo not in MVP).
- Pressure-sensitive input (Wacom), tilt/stylus support.
- Persistence/saving of user paintings to a gallery or cloud.
- Authentication, accounts, social sharing.
- Accessibility beyond keyboard shortcuts for core controls.
- Localization/i18n.

### 1.5 Non-functional MVP goals

- **60 FPS** canvas on mid-range desktop hardware (integrated GPU).
- **< 16.6 ms** per frame paint budget under typical stroke load.
- **Memory** stable under sustained strokes (no unbounded path-point growth).
- **Startup** under ~2 s to interactive on broadband.
- **Responsive** down to tablet landscape; mobile is best-effort.

---

## 2. Tech Stack Decision

### 2.1 Decision

- **Build tool:** Vite
- **Language:** TypeScript (strict)
- **Rendering:** HTML5 Canvas 2D (not WebGL, not DOM/SVG)
- **UI layer:** Vanilla TypeScript + minimal DOM (no React/Next.js)
- **Styling:** CSS Modules-free plain CSS (or a tiny Tailwind utility layer —
  see below)
- **Validation:** Zod
- **Testing:** Vitest (unit), Playwright (optional smoke)
- **Lint/format:** ESLint + Prettier; CI via GitHub Actions (deferred until
  GitHub publication is authorized)

### 2.2 Why Vite + Vanilla TS over React/Next.js

The brief allows either React/Next.js *or* Vite + Vanilla TS. We choose
**Vite + Vanilla TypeScript** for the MVP:

1. **Render decoupling.** The hard requirement is that the canvas render loop is
   *not* tied to React's re-render tree. A React wrapper adds a layer we must
   carefully break through (refs, `useImperativeHandle`, memo guards). Vanilla
   TS lets the render loop, sync engine, and brush engine own their state
   directly, with zero reconciliation cost. The UI is small (one control bar,
   one HUD badge, one floating video container) and does not justify a
   component framework's complexity.
2. **Performance determinism.** A 60 FPS budget is easier to guarantee when
   there is no virtual DOM and no scheduler in the hot path. Every frame of
   pointer → stroke → composite is synchronous and inspectable.
3. **Maintainability for a procedural engine.** The bulk of the code is canvas
   math and algorithms, which are framework-agnostic. Keeping the app free of a
   UI framework keeps the interesting code pure and testable.
4. **Smaller surface for the MVP.** Fewer moving parts (no SSR, no routing, no
   hydration). Vite gives HMR for the dev loop with near-zero config.
5. **Portability to later phases.** If Phase 2 migrates strokes to WebGL, the
   vanilla engine can be lifted wholesale; a React tree would not help that
   migration.

If the product later grows a large component surface (settings panels, script
editor, gallery), we can introduce React **then**, wrapping the existing vanilla
engine behind an imperative handle — the architecture in §8 is deliberately
compatible with that path.

### 2.3 Canvas2D vs WebGL (for the MVP)

- **Canvas2D** is chosen for MVP: it has built-in `globalAlpha`,
  `globalCompositeOperation` blend modes (`source-over`, `multiply`,
  `screen`, `lighter`), path primitives, and gradient/shadow support — all of
  which map directly to the four MVP tool types.
- WebGL would enable per-pixel blending, fluid simulation, and crisper "dry oil
  breaking" via shaders, but at much higher implementation cost and with no
  meaningful MVP benefit. It is the clear Phase 2 candidate (§13).
- **Decision rule:** ship Canvas2D now; isolate the brush engine behind a
  `Brush` interface so the renderer backend can be swapped to WebGL later.

### 2.4 Styling choice

Prefer a single hand-written stylesheet (`styles/app.css`) with CSS custom
properties for the dark "room" palette. This avoids a Tailwind build dependency
for a small UI. If Tailwind is desired later, the class-based markup ports
cleanly. (No CSS Modules needed given the tiny UI surface.)

### 2.5 Justification summary table

| Axis | Choice | Rationale |
|------|--------|-----------|
| Framework | None (Vanilla TS) | Render loop must stay off React tree |
| Canvas | Canvas2D | Blend modes + path API cover MVP; WebGL = Phase 2 |
| Validation | Zod | Runtime type-safety for the JSON script, single source of truth |
| Tests | Vitest | Vite-native, fast, TS-first |
| Styling | Plain CSS vars | Minimal UI; no build tax |
| Script format | TS types + Zod schema | Authorable, validatable, shareable |

---

## 3. Repository / File Structure

Full target tree with per-file purpose. Paths are relative to the repo root
(`/home/avner/projects/the-bob-of-ross`).

```
the-bob-of-ross/
├── README.md                         # Project overview, status, quickstart
├── .gitignore                        # node_modules, dist, .env, editor cruft
├── package.json                      # deps + scripts (dev/build/test/lint)
├── tsconfig.json                     # strict TS config
├── vite.config.ts                    # Vite config (dev server, build out)
├── index.html                        # app shell: <canvas>, overlays, script entry
├── eslint.config.js                  # ESLint flat config
├── .prettierrc                       # Prettier config
├── .github/
│   └── workflows/
│       └── ci.yml                    # lint + typecheck + test (enabled post-GitHub)
├── docs/
│   ├── INITIAL_SPEC.md               # Original brief (product requirements)
│   ├── IMPLEMENTATION_PLAN.md        # This document
│   ├── bob-transcript-s01e01.txt     # Chaptered transcript with timestamps
│   └── qa/                           # Gitignored screenshots/frames/metrics (§11.2)
├── public/
│   └── favicon.svg                   # App icon
├── src/
│   ├── main.ts                       # Bootstrap: wire modules, start rAF loop
│   ├── style.css                     # Global CSS vars + layout + UI styles
│   ├── types/
│   │   └── script.ts                 # TS types for tool script (single source)
│   ├── data/
│   │   ├── script.schema.ts          # Zod schema mirroring types
│   │   └── s01e01.json               # Authored script for A Walk in the Woods
│   ├── core/
│   │   ├── sync/
│   │   │   ├── SyncEngine.ts         # currentTime polling, segment lookup, drift
│   │   │   ├── YouTubePlayer.ts      # IFrame API wrapper (load/play/pause/seek)
│   │   │   └── segmentStore.ts       # Script → sorted segment index, binary search
│   │   └── state/
│   │       ├── AppState.ts           # Mutable app state (active tool, sync on/off)
│   │       └── eventBus.ts           # Tiny typed pub/sub (no UI re-renders)
│   ├── brush/
│   │   ├── Brush.ts                  # Brush interface + BrushContext (tool params)
│   │   ├── Stroke.ts                 # Stroke model: points, color, params
│   │   ├── interpolation.ts          # Bezier/catmull-rom smoothing helpers
│   │   ├── brushes/
│   │   │   ├── LiquidWhiteBrush.ts   # liquid_white_base: wide soft criss-cross
│   │   │   ├── SkyWashBrush.ts       # sky_wash: broad soft wash, opacity falloff
│   │   │   ├── PineTreeBrush.ts      # pine_tree_foliage: procedural needle stamps
│   │   │   └── MountainSnowBrush.ts  # mountain_snow: breaking knife edge + noise
│   │   └── BrushFactory.ts           # type → Brush instance registry
│   ├── render/
│   │   ├── Renderer.ts               # Main loop, offscreen base, DPR scaling
│   │   ├── compositor.ts             # Stroke accumulation → canvas composite
│   │   ├── particles.ts              # Ripple/particle effects
│   │   └── cursor.ts                 # Per-tool custom cursor rendering
│   ├── ui/
│   │   ├── ControlBar.ts             # Clear / Save PNG / toggle sync / audio
│   │   ├── ToolHud.ts                # Translucent tool badge
│   │   ├── VideoWindow.ts            # Floating draggable YouTube container
│   │   └── drag.ts                   # Generic drag/dock behavior
│   └── util/
│       ├── color.ts                  # Hex <-> rgb(a), color utils
│       ├── math.ts                   # lerp, clamp, vector helpers
│       └── time.ts                   # time formatting, monotonic helpers
└── tests/
    ├── unit/
    │   ├── syncEngine.test.ts        # Segment lookup, drift, seek, end, cadence
    │   ├── segmentStore.test.ts      # Binary search, boundary cases
    │   ├── schema.test.ts            # Zod validation of s01e01.json + fixtures
    │   ├── interpolation.test.ts     # Bezier sampling invariants
    │   └── brushes.test.ts           # no-op, size-mode, blend luminance, cache
    ├── fixtures/
    │   ├── valid.script.json         # Minimal valid script
    │   └── invalid.script.json       # Deliberately broken (for schema tests)
    └── qa/
        └── multimodal.spec.ts        # Playwright capture + visual compare (§11.2)
```

QA artifacts (screenshots, reference frames, metrics JSON) are written to
`docs/qa/` and are **gitignored**; only the capture scripts are committed.

### 3.1 Per-file purpose notes (the important ones)

- `types/script.ts` — the canonical TypeScript types. All engine code imports
  from here so a contract change is one place.
- `data/script.schema.ts` — Zod schema derived from the same shape; used at
  runtime to validate `s01e01.json` on load.
- `core/sync/SyncEngine.ts` — owns the `currentTime` → active segment mapping,
  emits tool-change events on the event bus, handles drift/lag/seek/end. Pure
  logic (no DOM), so it is unit-testable with a fake player.
- `core/sync/YouTubePlayer.ts` — thin wrapper around `window.YT.Player`; the only
  file that touches the YouTube IFrame API, so tests can mock it.
- `core/state/eventBus.ts` — a typed emitter. Canvas/engine subscribe; UI
  subscribes only for the HUD/control state it must display. This is how we keep
  UI re-renders out of the hot path (§8).
- `brush/Brush.ts` — the `Brush` interface; each tool type implements it. The
  engine calls `beginStroke`, `extendStroke(points)`, `endStroke` without knowing
  the tool's internals.
- `render/Renderer.ts` — the single `requestAnimationFrame` loop, DPR handling,
  offscreen base layer commit, and cursor/particle draw. This is the only file
  that writes to the visible canvas context per frame.
- `render/compositor.ts` — owns the offscreen base canvas (accumulated painting)
  and blits it to the visible canvas each frame. The brush strokes draw onto the
  *base*; transient effects (particles, cursor) draw onto the *visible* canvas.
- `ui/VideoWindow.ts` — floating, draggable player; subscribes to the event bus
  for play/pause/sync state but never participates in the render loop.
- `ui/ControlBar.ts` — the only control surface; commands go through the event
  bus to `AppState`, never touching canvas internals directly.

---

## 4. Data Layer

### 4.1 Canonical TypeScript types

```ts
// src/types/script.ts

/**
 * Engine brush families. These are *renderer* categories, not literal subject
 * names. The canonical script reuses them across the episode as follows:
 *   - `liquid_white_base` : broad bristle coat (intro + magic-white prep)
 *   - `sky_wash`          : broad soft wash (sky AND the final water/puddle
 *                           washes — any wide, soft, `multiply`/`screen` pass)
 *   - `pine_tree_foliage` : bristle brush that switches behavior by `size`:
 *                           size >= 18 → needle-cluster foliage stamps;
 *                           size <  18 → trunk/limb/twig ribbons (see §6.5)
 *   - `mountain_snow`     : the palette-knife family. Despite the name it is
 *                           used for the path, sheen, puddles, water lines and
 *                           the signature — *not* only snow (see §6.6)
 */
export type ToolType =
  | "liquid_white_base"
  | "sky_wash"
  | "pine_tree_foliage"
  | "mountain_snow";

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "lighter";

export interface ToolConfig {
  /** Human-readable brush name shown in the HUD. */
  name: string;
  /** CSS hex color, e.g. "#2C5282". */
  color: string;
  /** Discriminating tool type; drives the brush engine. */
  type: ToolType;
  /** 0..1 stroke opacity (alpha). */
  opacity: number;
  /** Brush footprint diameter/width in CSS px. */
  size: number;
  /** Canvas globalCompositeOperation for the stroke. */
  blendMode: BlendMode;
  /** Optional tool-specific knobs. */
  breakTexture?: boolean; // palette knife: crisp breaking edge
  spacing?: number;        // stamp spacing factor for fan/pine brushes
  flow?: number;           // 0..1 wet-on-wet flow / wetness factor
}

export interface Segment {
  /** Inclusive start, in seconds. */
  startTime: number;
  /** Exclusive end, in seconds. */
  endTime: number;
  /** Active tool for this window. */
  tool: ToolConfig;
  /** Optional captions/dialogue for future subtitle HUD. */
  bobDialogue?: string;
}

export interface ToolScript {
  /** YouTube video id. */
  videoId: string;
  /** Human-readable title. */
  title: string;
  /** Ordered, non-overlapping segments covering the video. */
  timeline: Segment[];
  /** Schema version for forward-compat. */
  version?: number;
}
```

### 4.2 Zod schema (runtime validation)

The Zod schema mirrors the types and is the load-time gate. It lives in
`src/data/script.schema.ts`:

```ts
import { z } from "zod";

const TOOL_TYPES = [
  "liquid_white_base",
  "sky_wash",
  "pine_tree_foliage",
  "mountain_snow",
] as const;

const BLEND_MODES = ["source-over", "multiply", "screen", "lighter"] as const;

export const toolConfigSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color"),
  type: z.enum(TOOL_TYPES),
  opacity: z.number().min(0).max(1),
  size: z.number().positive(),
  blendMode: z.enum(BLEND_MODES),
  breakTexture: z.boolean().optional(),
  spacing: z.number().positive().optional(),
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
  .refine((s) => {
    for (let i = 1; i < s.timeline.length; i++) {
      if (s.timeline[i].startTime < s.timeline[i - 1].endTime) return false;
    }
    return true;
  }, { message: "timeline segments must be ordered and non-overlapping" });
```

### 4.3 Canonical script vs. the brief's placeholder

The brief embedded a **4-segment, `0–600 s` mock script** for the placeholder
video id `OH94B9B8zDk`. That script was illustrative only and its timings do
**not** correspond to the canonical episode. The canonical script is
`src/data/s01e01.json`, derived from `docs/bob-transcript-s01e01.txt` and the
video `oh5p5f5_-7A`. Key deltas from the brief's mock:

| Aspect | Brief mock | Canonical script |
|--------|-----------|------------------|
| Video id | `OH94B9B8zDk` | **`oh5p5f5_-7A`** |
| Segments | 4 | **19** |
| Time span | `0–600 s` | **`0–1665 s`** (27:45) |
| Segment boundaries | 0/120/240/420/600 | see §4.4 |
| Tool-type usage | 1 pass each | reuse across subjects (below) |
| `screen` blend | unused | used for sky glow, highlights, sheen, water lines |
| `breakTexture` | knife only | all `mountain_snow` segments except the `Script Liner` signature |
| Optional knobs | none | `spacing` / `flow` on foliage, `breakTexture` on knife |

The brief's mock remains a **valid `ToolScript`** (so `tests/fixtures/valid.script.json`
may reuse its shape), but all engine tests, sync boundaries, and QA procedures
in this plan use the canonical 19-segment script.

### 4.4 Canonical `s01e01.json` (19 segments)

`src/data/s01e01.json` is the **single source of truth**; the table below is a
derived, human-readable view used for review and for authoring test fixtures.
Segment 1 is a deliberate **`opacity: 0` "no paint" intro** — the brush layer
must treat zero opacity as a complete no-op (§6.2) while the HUD still updates.

| # | Time (mm:ss) | `type` | Brush / HUD name | size | blend | Intent (transcript anchor) |
|---|--------------|--------|------------------|------|-------|-----------------------------|
| 1 | 0:00–2:11 | `liquid_white_base` | Intro — no paint | 60 | source-over | equipment/color review; opacity 0 |
| 2 | 2:11–3:38 | `liquid_white_base` | 2½-inch Brush | 60 | source-over | thin even "magic white" coat |
| 3 | 3:38–4:12 | `sky_wash` | 2-inch Brush | 50 | multiply | Cad yellow + touch of Phthalo green, X strokes |
| 4 | 4:12–4:52 | `sky_wash` | 2-inch Brush | 50 | multiply | Prussian blue criss-cross, light source |
| 5 | 4:52–6:08 | `sky_wash` | 2-inch Brush | 55 | **screen** | clean brush, Titanium white center, blend sky |
| 6 | 6:08–8:10 | `pine_tree_foliage` | 2-inch Brush | 25 | source-over | Alizarin crimson + Prussian blue basic tree shapes |
| 7 | 8:10–9:15 | `pine_tree_foliage` | 1-inch Brush | 12 | source-over | Van Dyke brown trunks, limbs, twigs |
| 8 | 9:15–9:59 | `pine_tree_foliage` | 1-inch Brush | 10 | **screen** | white + brown highlight, light source |
| 9 | 9:59–14:41 | `pine_tree_foliage` | 2-inch Brush | 30 | source-over | Phthalo green + yellow "thousands of leaves" |
| 10 | 14:41–15:49 | `mountain_snow` | Palette Knife | 15 | source-over | Van Dyke brown happy little path |
| 11 | 15:49–17:05 | `pine_tree_foliage` | 2-inch Brush | 22 | source-over | bushes project over path to set depth |
| 12 | 17:05–18:01 | `sky_wash` | 2-inch Brush | 40 | multiply | Prussian blue rain puddle, pull downward |
| 13 | 18:01–18:45 | `mountain_snow` | Palette Knife | 12 | **screen** | Titanium white sheen on puddle |
| 14 | 18:45–20:33 | `mountain_snow` | Palette Knife | 14 | source-over | more Van Dyke brown puddles |
| 15 | 20:33–21:46 | `mountain_snow` | Palette Knife | 8 | **screen** | thin white water lines, cut into canvas |
| 16 | 21:46–23:29 | `pine_tree_foliage` | 2-inch Brush | 20 | source-over | bushes/grass down on soil |
| 17 | 23:29–24:16 | `pine_tree_foliage` | 1-inch Brush | 14 | source-over | final tree trunk + "little foots" |
| 18 | 24:16–26:47 | `pine_tree_foliage` | 2-inch Brush | 24 | source-over | crimson + Prussian blue leaves, dark-before-light |
| 19 | 26:47–27:45 | `mountain_snow` | Script Liner | 4 | source-over | signature (`breakTexture: false`) |

**Tool-type mapping notes (important for the engine):**

- `mountain_snow` is the **palette-knife family**, reused for path (10),
  sheen (13), puddles (14), water lines (15) and the signature (19). The
  signature is a knife/liner stroke at `size: 4` with `breakTexture: false`;
  it must render a crisp continuous line, not a broken edge (§6.6.5).
- `sky_wash` is any wide soft wash, including the ground puddles (12), not just
  the sky. Blend mode comes from the data (`multiply` or `screen`); the brush
  must never hard-code `multiply`.
- `pine_tree_foliage` covers tree *anatomy*, not only foliage. Segments 7, 8
  and 17 use small sizes (10–14) and expect **trunk/limb/twig ribbons**;
  segments 6, 9, 11, 16, 18 use larger sizes (20–30) and expect **needle
  clusters**. The brush selects its mode from `size` (§6.5).
- `liquid_white_base` with `opacity: 0` (segment 1) is a no-op paint segment
  used for the intro. The sync engine still emits `tool:change` so the HUD
  reads "Intro — no paint".

### 4.5 Loader & validation approach

1. **Load** — `data/s01e01.json` is imported as a module (Vite bundles JSON) or
   fetched at runtime; MVP uses the static import for zero-fetch simplicity.
2. **Parse & validate** — run `toolScriptSchema.safeParse(raw)`. On failure,
   log the Zod error path + message, surface a non-blocking error toast, and
   fall back to a safe default segment (a neutral `liquid_white_base`) so the
   app still runs. A hard failure that blocks painting is worse than a degraded
   default.
3. **Normalize** — convert to a `SegmentStore`: sort by `startTime`, verify
   contiguity, and build a flat array for binary search. Store also records the
   total script duration (last `endTime`).
4. **Memoize** — the store is built once and reused; the sync engine queries it
   by index, never by linear scan each frame (§5.3).
5. **Forward-compat** — the optional `version` field lets future scripts carry
   new tool types; the schema rejects unknown `type` values so the engine never
   silently misbehaves.

---

## 5. Synchronization Engine

### 5.1 Overview

The sync engine maps the YouTube player's `currentTime` to the active `Segment`
and emits tool-change events. It is **pure logic** (no DOM, no canvas): it takes
a `TimeSource` interface (implemented by the YouTube wrapper) and a
`SegmentStore`, and it emits events through the event bus. This makes it fully
unit-testable with a fake clock/player.

```ts
// core/sync/SyncEngine.ts (shape)
interface TimeSource {
  getCurrentTime(): number;
  getDuration(): number;
  getState(): "unstarted" | "playing" | "paused" | "ended" | "buffering";
}

class SyncEngine {
  constructor(timeSource: TimeSource, store: SegmentStore, bus: EventBus);
  start(): void;   // begin polling loop
  stop(): void;    // tear down polling
  seek(t: number): void; // force re-eval (called after user seek)
  private tick(): void;  // one poll: time -> segment -> emit on change
}
```

### 5.2 YouTube IFrame API integration

- Load the IFrame Player API script lazily (deferred, after first user gesture
  or on `load`), then instantiate `new YT.Player(container, {...})`.
- `YouTubePlayer.ts` wraps the `YT.Player` instance and implements `TimeSource`,
  exposing `play()`, `pause()`, `seekTo(t)`, `mute()`/`unMute()`.
- Events (`onStateChange`, `onReady`) are translated to bus events:
  `video:ready`, `video:playing`, `video:paused`, `video:ended`, `video:seek`.
- **Autoplay note:** browsers block autoplay with sound. The MVP does not
  auto-play; it requires the user to press Play. Sync/audio toggle respects this
  by muting/unmuting rather than attempting a blocked autoplay.

### 5.3 currentTime polling: rAF vs setInterval(100ms)

**Decision: a single `requestAnimationFrame` loop drives both painting and
sync evaluation. There is no `setInterval`. The sync check is normally throttled
to `250 ms`, but escalates to every frame as a segment boundary approaches.**

Concretely, with two constants:

```ts
const SYNC_INTERVAL_MS = 250;   // steady-state cadence
const BOUNDARY_BAND_MS = 400;   // switch to per-frame inside this band
```

- The main rAF loop runs every frame (~16.6 ms) for painting/compositing.
- Inside it, `SyncEngine.maybeTick(now)` is called each frame. It returns early
  unless `now - lastSyncAt >= SYNC_INTERVAL_MS` **or** the cached
  `timeToNext <= BOUNDARY_BAND_MS` **or** a seek was flagged. This is the
  **hybrid cadence**: cheap in the middle of a long segment, frame-accurate at
  the boundary where the tool actually changes.
- `getCurrentTime()` is called at most once per evaluated frame and its result
  is cached in `AppState.currentTime` for the HUD countdown.
- The brief suggests "rAF or setInterval at 100ms." We choose **throttled rAF**
  because it avoids a second timer, shares the existing frame budget, and never
  stacks up behind a busy main thread the way a free-running interval can.

Rationale for the cadence:

| Poll cadence | Evals/sec | Boundary latency | Notes |
|--------------|-----------|------------------|-------|
| every frame | 60 | <16 ms | only needed near a boundary |
| 100 ms | 10 | ≤100 ms | separate timer; stacks under load |
| **250 ms steady + per-frame near boundary** | **4 steady** | **≤16 ms at boundary** | **chosen: cheapest average, no perceptible switch** |

An important property: because the engine resolves by **absolute
`currentTime`**, not by counting frames, skipping evaluations can never
accumulate drift. The hybrid cadence only affects *when* we notice a change,
never *which* segment is correct.

### 5.4 Segment lookahead

The engine maintains:

- `activeSegment` — the segment containing `currentTime`.
- `nextSegment` — the segment after `activeSegment` (the lookahead target).
- `timeToNext` — `nextSegment.startTime - currentTime`, clamped ≥ 0.

This lookahead serves two purposes:

1. **HUD pre-warning** — the tool badge can show "next: Palette Knife in
   1:08" (subtle), which aids the relaxing UX without interrupting. The
   countdown string is only recomputed on the throttled tick (≤4 Hz), never per
   frame.
2. **Pre-warming** — the brush engine can pre-allocate/prepare the next
   brush's parameters during idle frames, so the switch at the boundary is
   instant and causes no frame hitch (§6, §9). The contract is:

   ```ts
   interface Brush {
     // ... beginStroke/extendStroke/endStroke
     /** Idempotent; warms sprite/geometry caches for an upcoming tool. */
     prepare(tool: ToolConfig): void;
   }
   ```

   `SyncEngine` calls `brushFactory.for(nextSegment.tool).prepare(nextSegment.tool)`
   when `timeToNext <= BOUNDARY_BAND_MS` and only if `nextSegment` changed since
   the last warm call. `prepare` must never draw to the base canvas and must be
   safe to call repeatedly.

Lookahead is recomputed on every sync evaluation (cheap: one integer index).
Worked example against the canonical boundaries: at `t = 160 s` the active
segment is #2 (`2½-inch Brush`/`liquid_white_base`, `131–218`) and `timeToNext
= 218 - 160 = 58 s`, so the engine is in steady-state 250 ms cadence. At `t =
217.8 s` the engine enters the boundary band and warms segment #3's
`sky_wash` sprite; the tool switches within one frame of `t = 218`.

### 5.5 Boundary, drift, and lag handling

- **Segment lookup** — binary search over `store.flat` by `startTime`; returns
  the segment whose `[startTime, endTime)` contains `t`.
- **Contiguity** — the store guarantees ordered, non-overlapping segments; gaps
  are disallowed by the schema. If a gap is ever introduced by a hand edit, the
  engine falls back to the *previous* segment's tool until the next segment
  begins (never leaves "no tool").
- **Coverage / normalization** — the loader sorts by `startTime` and, if the
  first segment does not start at 0, synthesizes a `0 → first.startTime` segment
  carrying the first segment's tool but `opacity: 0` (a no-paint intro). If the
  video duration exceeds the last `endTime`, the last tool is held to the end
  (see "End"). Both rules are applied at store-build time, not per tick.
- **Intro handling** — a segment with `opacity: 0` (canonical segment #1) is a
  valid active tool: `tool:change` fires so the HUD updates, but the brush
  layer checks `tool.opacity === 0` and draws nothing (§6.2). This keeps the
  "no paint" state explicit rather than special-casing it in the sync engine.
- **Drift correction** — `getCurrentTime()` is authoritative; we never
  accumulate a local offset. If the video stalls/buffers, the time source stops
  advancing, so the engine naturally holds the current tool — no desync.
- **Buffering** — on `getState() === "buffering"` the engine holds the current
  tool and does not emit spurious changes; it does not enter the boundary band
  from a frozen clock (guard: only warm when time is advancing).
- **Lag (missed boundaries)** — because we re-evaluate by absolute time (not by
  incrementing a counter), a delayed frame still resolves to the *correct*
  segment for the current `currentTime`. There is no drift accumulation.
  Boundary crossing is therefore at most one evaluation late and self-corrects
  on the next tick.
- **Seek** — on `video:seek` the engine sets a `pendingSeek` flag so the next
  frame evaluates regardless of throttle, then clears it. A detected
  non-monotonic jump (`|currentTime - prevTime| > max(1.5 s, 4 × frameDt)`
  while `playing`) is treated as an implicit seek (covers programmatic/iframe
  seeks that don't fire our handler). The engine re-evaluates immediately and
  emits `tool:change` only if the resolved segment actually changed, preventing
  a stale tool and eliminating redundant HUD updates after scrubbing.
- **Anti-flap** — tool changes are only emitted when the resolved segment
  identity changes. Repeated ticks inside one segment never re-emit.
- **End** — on `video:ended` (or `currentTime` ≥ store.duration by > 0.5 s),
  the engine emits `video:ended`; painting is left enabled so the user can keep
  adding strokes with the last tool (a pleasant "finish your painting" moment),
  and the HUD switches to a "finish mode" hint.

### 5.6 Play / pause / seek / end behavior summary

| Event | Engine action |
|-------|---------------|
| `video:ready` | build/verify store, set active segment at t=0 |
| `video:playing` | begin throttled evaluation |
| `video:paused` | hold current tool; stop evaluation (freeze active tool) |
| `video:seek(t)` | immediate re-eval; emit tool change if needed |
| `video:ended` | hold last tool; enter finish mode |
| sync toggle off | freeze active tool; ignore time source |

### 5.7 "Toggle sync/audio" semantics

The brief's `Toggle Audio/Sync` is two distinct concerns; MVP implements them as
one toggle button with a clear label or two sub-states:

- **Sync ON** (default): tool follows video time.
- **Sync OFF** ("Free Paint"): tool frozen at the last active tool; user paints
  freely without time coupling. This is the escape hatch for users who want to
  keep a tool longer than Bob does.
- **Audio mute/unmute** is a separate control; it does not affect sync.

### 5.8 Reference implementation (tick pseudocode)

```ts
const SYNC_INTERVAL_MS = 250;
const BOUNDARY_BAND_MS = 400;

// Called once per rAF frame from the render loop.
maybeTick(now: DOMHighResTimeStamp): void {
  const shouldEval =
    this.pendingSeek ||
    now - this.lastEvalAt >= SYNC_INTERVAL_MS ||
    (this.timeToNext <= BOUNDARY_BAND_MS && this.player.isAdvancing());
  if (!shouldEval) return;
  this.pendingSeek = false;
  this.lastEvalAt = now;

  const t = this.player.getCurrentTime();
  const prevT = this.lastTime;
  this.lastTime = t;

  // Implicit seek from a non-monotonic jump while advancing.
  if (this.player.getState() === "playing" && Math.abs(t - prevT) > Math.max(1.5, 4 * this.frameDt)) {
    this.pendingSeek = true; // force a clean re-eval next tick too
  }

  const segIdx = this.store.indexAt(t);          // binary search
  const changed = segIdx !== this.activeIdx;

  // Always refresh active/next/lookahead so the boundary band is entered even
  // when the segment itself has not changed yet.
  this.activeIdx = segIdx;
  this.activeSegment = this.store.segments[segIdx];
  this.nextSegment = this.store.segments[segIdx + 1] ?? null;
  this.updateLookahead(t);                        // sets state.timeToNext

  if (changed) {
    this.state.activeTool = this.activeSegment.tool;
    this.bus.emit("tool:change", { prev: this.prevTool, next: this.state.activeTool });
    this.prevTool = this.state.activeTool;
  }

  // Warm the next brush while there is time (idempotent; prepare never draws).
  if (this.timeToNext <= BOUNDARY_BAND_MS && this.nextSegment) {
    this.brushes.for(this.nextSegment.tool).prepare(this.nextSegment.tool);
  }
}
```

`SegmentStore.indexAt(t)` is a binary search over a precomputed `startTimes`
array returning the greatest index with `startTimes[i] <= t`; it clamps to
`[0, n-1]` so pre-roll and post-roll never return `undefined`.

---

## 6. Brush / Texture Engine

### 6.1 Architecture

- A `Stroke` is a list of input points `{x, y, time, pressure?}` captured from
  pointer events (pointer coordinates only in MVP; pressure is a Phase 2 nicety).
- `interpolation.ts` resamples the raw points into a smooth polyline using
  quadratic midpoint Bezier smoothing (and optionally Catmull-Rom for speed),
  producing evenly spaced samples at `spacing` distance for stamp-based brushes.
- A `Brush` implements three lifecycle methods:

```ts
interface Brush {
  beginStroke(ctx: BrushContext): void;
  extendStroke(points: Point[]): void; // draws onto the base canvas
  endStroke(): void;
}

interface BrushContext {
  ctx: CanvasRenderingContext2D; // offscreen base layer context
  tool: ToolConfig;              // resolved active tool (color/size/etc)
  pos: Point;                    // current smoothed cursor position
  vel: number;                   // cursor speed (px/frame) for dynamics
}
```

- The `BrushFactory` maps `tool.type` → brush instance (singletons, stateless
  between strokes). The engine never branches on tool type in the hot path; it
  just calls the current brush.

### 6.2 Common stroke primitives

**Bezier smoothing (quadratic midpoint).** Keep the raw points; the polyline
never passes through them directly. For each interior point `p1` between
neighbors `p0` and `p2`:

```
m01 = (p0 + p1) / 2
m12 = (p1 + p2) / 2
quadraticBezierTo(m12, m01, m12)   // Canvas2D: ctx.quadraticCurveTo(cx, cy, x, y)
```

The rendered curve passes through the midpoints `m01, m12, …`, which removes
jitter with a `dt`-independent lag of half a sample. For fast sweeps, scale the
deviation from the raw point by a speed factor so the path tracks the pointer:

```
speedFactor = clamp(1 - |p1 - m01| / trackRadius, 0.25, 1)   // trackRadius ≈ size
controlPoint = lerp(p1, m01, speedFactor)
```

**Spacing resample.** After smoothing, walk the path by arc length and emit
stamps at a fixed step:

```
step = size * spacing            // spacing default 0.35 for foliage, 0.25 for washes
for d in [0 .. totalLength) step:
    (pos, tangent) = pointAtArcLength(path, d)   // O(1) via cached cumulative lengths
    stamp(pos, tangent)
```

**Opacity falloff.** Soft brushes bake a radial falloff into a stamp sprite.
With normalized radius `r = dist / R` (clamped to `[0,1]`), the two falloffs
used are:

```
gaussian : alpha(r) = exp(-4.5 * r^2)          // ≈0.10 at the edge (r=1) → chosen for sky_wash
smooth   : alpha(r) = (1 - r^2)^2              // 0 at the edge → chosen for liquid_white_base
```

The sprite is a `2R × 2R` offscreen canvas (pre-multiplied tint via
`color + globalAlpha`), blitted with `drawImage`; only `globalAlpha` changes per
stamp, so no per-stamp gradient is ever constructed.

**Wet-on-wet layering.** Every stroke draws onto a persistent **offscreen base
canvas** using the tool's `globalCompositeOperation` and `globalAlpha`. Before
any work, guard against no-paint tools:

```ts
if (tool.opacity === 0) return;   // intro/no-paint segment — no-op
```

Because wet-on-wet mixes already-laid paint with new strokes, we rely on the
canvas's own alpha compositing (and `multiply`/`screen` from the data) rather
than modeling physical pigment mixing. `flow` scales per-stamp alpha so repeated
passes build density like real wet-on-wet layering.

### 6.3 `liquid_white_base` — 2-inch brush, wide soft criss-cross

1. `beginStroke`: `globalAlpha = tool.opacity`, `globalCompositeOperation =
   tool.blendMode`. If `tool.opacity === 0`, return immediately (intro).
2. Stamp a cached `smooth`-falloff sprite (`alpha(r) = (1 - r²)²`) of radius
   `R = size / 2`, tinted `tool.color`. Per-stamp alpha:
   `a = tool.opacity * (0.85 + 0.15 * tool.flow) * strokePressure` (MVP
   `strokePressure = 1`).
3. `step = size * 0.25` → consecutive stamps overlap ~75% → continuous wash.
4. **Criss-cross:** ellipse orientation angle `θ(s) = θ0 + 0.7 * sin(s / size)`
   where `s` is arc length, and perpendicular jitter
   `j = size * 0.08 * noise1D(s * 0.05)`. The sprite is stamped with
   `ctx.rotate(θ)` + `ctx.translate(tangentPerp * j)`, giving the hand-applied
   crosshatch rather than a flat fill.
5. Opacity is low (`0.05–0.1`); repeated drags build the translucent base
   gradually ("thin coat of magic white"). Because the alpha is per-stamp and
   the base accumulates, `n` overlapping passes approach opacity
   `1 - (1 - a)^n` — a natural build-up curve.

**Canvas prep special case:** the canonical intro (segment #1) uses this type
with `opacity: 0`; the visible white prep is segment #2. Unit tests assert the
no-op path leaves every base pixel unchanged (`getImageData` checksum).

### 6.4 `sky_wash` — broad soft wash with opacity falloff

1. Same family as the base but with a **wider, softer** stamp: radius
   `size * 1.4`, gaussian falloff (alpha falls to ~10% at the stamp edge).
2. `blendMode` is read from the script for every segment — **never hard-coded**.
   The canonical script uses `multiply` for the yellow/blue sky (segments 3, 4)
   and the ground puddle (12), so the wash *tints* the white base; it uses
   `screen` for the Titanium-white sky glow (5), lifting luminance instead.
3. Opacity is `0.35–0.5` and density is speed-dependent. Let `v` be cursor
   speed in `px/frame` and `v_ref = 8`:
   `a = tool.opacity * flow * clamp(1 - (v / v_ref) * 0.6, 0.2, 1)`.
   A slow pass lays more pigment; a fast sweep skims (`0.2×`).
4. Falloff is baked once into an offscreen **stamp sprite** and cached; the
   sprite is blitted with `drawImage` and only `globalAlpha`/rotation change per
   stamp — the single biggest perf win for soft brushes (§9). Rotate the sprite
   to the path tangent so the wash reads as directional brushwork, not a
   sequence of discs.

### 6.5 `pine_tree_foliage` — bristle brush; mode switches on `size`

This engine type covers tree **anatomy**. The canonical script uses it for
needle-bearing boughs *and* for trunks/limbs/highlights (§4.4), so the brush
selects one of two modes from `size`:

```
MODE_CLUSTER if size >= 18   // needle stamps, used by segments 6,9,11,16,18
MODE_RIBBON  if size <  18   // tapered trunk/limb/twig ribbon, segments 7,8,17
```

**(a) MODE_CLUSTER — procedural needle stamps.**

1. The brush **stamps**, it does not drag a continuous line. `extendStroke`
   places a cluster at each smoothed sample spaced by `step = size * spacing`
   (canonical `spacing ≈ 0.3–0.35`).
2. A cluster is `n = round(lerp(7, 11, size/30))` thin needles radiating from
   an anchor. With a seeded PRNG (`mulberry32(strokeSeed ^ sampleIndex)`), per
   needle `k`:
   ```
   dir   = fanAxis + k/n * (1.2 rad) - 0.6 rad + rand(-0.08, 0.08)
   len   = size * (0.6 + 0.5 * rand())
   alpha = tool.opacity * (0.7 + 0.3 * rand())
   width = max(1, size * 0.04)
   ```
   `fanAxis` follows the path tangent when moving (pointing "up"/outward like a
   bough); when stationary it defaults to `-π/2` plus jitter. Draw the whole
   cluster into a cached sprite.
3. Sprite cache key:
   `cluster|${color}|${size}|${round(opacity*100)}|${mode}` (bounded LRU, §9.3).
   At draw time only `drawImage` + `rotate(fanAxis)` + `globalAlpha` run, so a
   stamp is O(1).
4. Layering: `source-over` stamps accumulate on the base; later foreground
   segments naturally occlude earlier background foliage — free wet-on-wet
   depth. The `screen` highlight (segment 8) is a separate `MODE_RIBBON`
   segment and lightens instead of covering.

**(b) MODE_RIBBON — trunks, limbs, twigs, highlights.**

1. This is a **tapered ribbon**, not stamps. Build a polygon around the
   smoothed path with half-width
   `w(s) = (size/2) * (0.55 + 0.45 * (1 - |s - s_mid| / (L/2)))`, i.e. fullest
   at the middle and ~55% at the ends, then fill once.
2. Add 1–2 short side "twigs" every `size * 2.0` of arc length at angles
   `±(0.5–1.1) rad`, length `size * (0.4–0.9)`, with a slight PRNG jitter, so
   trunks sprout plausible little sticks.
3. `flow` scales width (`w *= 0.7 + 0.3 * flow`); `breakTexture` is ignored in
   this mode. `blendMode` follows the data (`source-over` for trunks,
   `screen` for the highlight).

### 6.6 `mountain_snow` — palette knife, crisp breaking edge + noise

1. **Solid mode (`breakTexture: false`, e.g. the `Script Liner` signature).**
   Draw one continuous **tapered ribbon**: half-width
   `w(s) = (size/2) * (0.7 + 0.3 * (1 - |s - L/2| / (L/2)))`, filled in a
   single path with round caps. This is the crisp, unbroken line used to sign
   the painting.
2. **Breaking mode (`breakTexture: true`).** Do *not* fill a solid ribbon.
   Walk the path and emit **perpendicular flecks** whose density and length
   depend on cursor speed `v` (px/frame) and `flow`:
   ```
   step     = size * (0.35 - 0.2 * clamp(flow, 0, 1))   // more flow → denser
   dryness  = clamp(v / 12, 0, 1)                        // fast → drier/breaking
   flecksPerStep = round(lerp(4, 1, dryness))            // fast path thins out
   dashLen  = size * lerp(0.9, 0.25, dryness) * (0.6 + 0.8 * rand())
   if (rand() < 0.15 * (1 - flow)) continue              // random gaps
   ```
   Each fleck is a 1–`max(1, size*0.12)` px dash drawn perpendicular to the
   tangent at a PRNG offset within `±w(s)`, so heavy/slow areas bunch into
   paint and fast areas break into dry streaks.
3. **Noise:** per-fleck jitter (length ± 40%, rotation ± 0.2 rad) plus a faint
   speckle (a few 1 px dots scattered within `1.2 × size/2` of the edge) so the
   edge is crisp but irregular, never a clean vector line.
4. `opacity` is near `1.0` (knife paint is opaque); `flow` scales fleck density.
   **`blendMode` comes from the data, never hard-coded.** The canonical knife
   uses `source-over` for the brown path/puddles (10, 14) and the signature
   (19) — these lay dark paint on top — but `screen` for the white sheen (13)
   and water lines (15), which must *lighten* the puddle rather than cover it.
   In all cases the knife writes to the base canvas like any other brush; the
   only difference is the stroke geometry.

**Reference (breaking mode) pseudocode:**

```ts
for (const s of sampleByArcLength(path, step)) {
  const (p, tangent) = s; const normal = perp(tangent);
  const w = halfWidth(s.arcLen, totalLen, tool.size) * jitter(0.9, 1.1);
  for (let k = 0; k < flecksPerStep; k++) {
    if (rand() < 0.15 * (1 - tool.flow)) continue;
    const off = rand(-w, w);
    const base = add(p, mul(normal, off));
    const len = dashLen * jitter(0.6, 1.4);
    const ang = atan2(tangent.y, tangent.x) + PI/2 + rand(-0.2, 0.2);
    strokeDash(ctx, base, ang, len, max(1, tool.size * 0.12));
  }
}
```

### 6.7 Blend modes and wet-on-wet layering

| Mode | Canonical segments | Effect |
|------|--------------------|--------|
| `source-over` | 1,2,6,7,9,10,11,14,16,17,18,19 | normal paint-on-top (browns, greens, path, signature) |
| `multiply` | 3,4,12 | translucent tint that darkens/mixes (sky yellow/blue, puddle blue) |
| `screen` | 5,8,13,15 | lightening blend (white sky glow, tree highlight, puddle sheen, water lines) |
| `lighter` | (reserved — not used) | additive glow for Phase 2 effects only |

Wet-on-wet is achieved structurally: strokes accumulate on the offscreen base
canvas, so later strokes physically overlap earlier ones; combined with
per-stamp alpha (`flow`), repeated passes build density the way oil paint does.
We deliberately avoid a full pigment-mixing model in MVP — Canvas2D compositing
is "good enough" for the relaxing feel.

### 6.8 Offscreen base layer & render loop decoupling

- **Base layer:** a single offscreen `<canvas>` (via `OffscreenCanvas` where
  available, else a detached `document.createElement('canvas')`) holds the
  *accumulated painting*. All brush strokes draw here. It persists across
  frames and is never cleared except on "Clear Canvas."
- **Visible layer:** the on-screen `<canvas>` is repainted every frame by the
  `Renderer`: (1) `drawImage(base, ...)` scaled to device pixels; (2) overlay
  transient effects (ripples/particles) and the custom cursor.
- **Why two layers:** the expensive composite (blit + effects) is a single
  `drawImage` per frame; brush strokes never redraw every frame. Only active
  stroke segments and effects touch the visible context. This is the core of
  the 60 FPS guarantee.
- **Decoupling:** the render loop (`requestAnimationFrame`) is the only thing
  that reads canvas. UI state changes (active tool, sync toggle) update
  `AppState` and the event bus; the loop reads `AppState` via a plain reference
  each frame — no React, no subscription churn, no per-frame allocations.

---

## 7. UI Components

All UI is minimal and styled with CSS custom properties on the dark "room"
palette. UI elements are plain DOM, created once at startup and mutated by
reference (no virtual DOM). They live *outside* the render hot path (§8).

### 7.1 Layout & palette

- Root is a full-viewport dark room (near-black `#0f1115` to `#14161c` radial
  gradient), with the canvas filling 80–85% of the viewport and centered.
- The canvas has a subtle border/shadow to read as an easel.
- Floating UI sits above the canvas with a translucent `backdrop-filter: blur`
  and low-opacity panels so the painting always dominates.

### 7.2 Floating, draggable YouTube player

- A small `<div id="video-window">` (~360×202, 16:9) positioned bottom-right by
  default; contains the `YT.Player` mount.
- **Drag:** pointer-down on the window header starts a drag; pointer-move
  updates `transform: translate()`; pointer-up snaps within viewport bounds.
  Implemented in `ui/drag.ts` (generic, reused for any dockable panel).
- **Dock/minimize:** a header button toggles a collapsed "pill" that shows only
  play/pause and a small thumbnail region; clicking expands back.
- **Controls:** minimal — Play/Pause, a slim progress bar (seek on click), and
  Minimize. No full YouTube chrome; the IFrame API provides our controls.

### 7.3 Tool HUD badge

- A translucent floating badge near the video window (or top-left, configurable)
  showing the active tool: `Tool: 2-inch Brush | Color: #2C5282 | Mode: Sky Wash`.
- Updates by subscribing to `tool:change` on the event bus — it re-renders its
  ~50 DOM nodes' text only on actual tool changes (≤ 2 Hz), never per frame.
- A small **"next"** line optionally shows the upcoming tool + countdown
  (from §5.4 lookahead), e.g. `next: Palette Knife in 1:08`, dimmed.

### 7.4 Top control bar

| Control | Action | Notes |
|---------|--------|-------|
| **Clear Canvas** | reset base layer to liquid-white-fresh | also clears active stroke state |
| **Save Image (.png)** | `canvas.toDataURL('image/png')` → download | uses the *base* canvas at native res |
| **Toggle Sync** | freeze/follow tool time | label flips Free Paint / Follow Bob |
| **Toggle Audio** | `player.mute()` / `unMute()` | independent of sync |
| (dev) **Show script** | dump active segment | hidden behind a dev flag, aids QA |

The control bar is a single `<nav>` top-center with icon+label buttons; it
subscribes to the bus for state (sync on/off, muted) and *commands* state
changes through `AppState` (§8).

### 7.5 Per-tool cursor feedback

- The OS cursor is hidden (`cursor: none`) over the canvas; the render loop
  draws a **custom cursor** each frame at the pointer position, selected by the
  active tool:
  - **2-inch brush** — a wide soft-edged rectangle outline sized to `tool.size`.
  - **Fan brush** — a fan glyph (arc of short radial lines).
  - **Palette knife** — an angled blade outline (rotated parallelogram).
- The cursor is drawn as a `screen`-blended translucent shape so it reads as a
  subtle guide, never covering the paint.
- **Ripple/particle feedback:** on each new stroke stamp, spawn a few low-alpha
  particles (2–6 per stamp) that expand and fade over ~400 ms, drawn on the
  visible layer. Particle count is capped (e.g., ≤ 256 live) to protect the
  frame budget (§9).

### 7.6 Error/status affordances

- A non-intrusive toast (top-center, auto-dismiss) surfaces: script validation
  failure (with fallback notice), YouTube API load failure, and Save success.
- No modal dialogs in MVP; all feedback is transient and tranquil.
- Toasts form a **bounded FIFO queue** (max 3 visible, 4 s auto-dismiss,
  hover pauses the timer) so repeated failures cannot stack into a wall. The
  queue is drawn outside the canvas and never touches the render loop.

### 7.7 Pointer & keyboard interaction contract

- **Pointer lifecycle:** `pointerdown` on the canvas captures the pointer
  (`setPointerCapture`) and starts a stroke; `pointermove` extends; `pointerup`
  / `pointercancel` / `lostpointercapture` end it. Because capture is held,
  dragging over the video window continues the stroke correctly; the video
  window itself stops propagation on its chrome. Secondary button is ignored.
- **Walk-away safety:** ending a stroke when the pointer leaves the viewport is
  **not** required (capture keeps it), but `blur`/`visibilitychange` force-end
  any live stroke to avoid a dangling path point.
- **Keyboard shortcuts** (implemented in `ui/ControlBar.ts`, documented in a
  `?` overlay):

  | Key | Action |
  |-----|--------|
  | `Space` | Play/Pause video |
  | `S` | Toggle Sync (Follow Bob / Free Paint) |
  | `M` | Toggle Audio mute |
  | `C` | Clear Canvas (requires confirm if any paint exists) |
  | `P` | Save PNG |
  | `[` / `]` | Seek −5 s / +5 s |
  | `H` | Toggle HUD visibility |

  Shortcuts are ignored while focus is in an input and when a modifier key is
  held. The "Clear requires confirm if paint exists" rule uses a cheap
  `baseHasPaint` dirty flag set by the first non-no-op stroke and cleared on
  Clear — no full-canvas readback.

### 7.8 Responsive layout & breakpoints

| Viewport | Canvas | Video window | Control bar |
|----------|--------|--------------|-------------|
| ≥ 1280 px | 85% centered | 360×202 floating bottom-right | top-center, icon+label |
| 768–1279 px | 80% | 320×180 | top-center, icons only |
| < 768 px (landscape) | 100% (letterboxed art) | docked top-left, collapsible to a 48 px pill | bottom bar, 44 px touch targets |

- The canvas backing store is recomputed on `ResizeObserver` with
  `dpr = min(devicePixelRatio, 2)` (§9.2); a resize debounced to one rAF frame
  re-blits the base so content scales without flicker.
- The floating window is clamped inside the viewport on drag-end and on resize;
  a small "snap" margin (12 px) docks it flush to a corner when released near
  one. Position persists for the session (not localStorage in MVP).

### 7.9 Loading, failure & accessibility states

- **Bootstrap sequence:** shell renders immediately (canvas + disabled
  controls) → script loads/validates → player mounts. Before `video:ready` the
  HUD reads `Tool: —` and controls are disabled with reduced opacity; the user
  can still paint (the engine uses the loader's fallback tool).
- **YouTube failure:** if the IFrame script fails to load or fires `onError`,
  show a persistent (non-auto-dismiss) notice with a "Free Paint" fallback that
  keeps sync off; the canvas remains fully usable.
- **Accessibility (MVP floor):** all controls are real `<button>`s with
  `aria-label`s and visible `:focus-visible` rings; the HUD is
  `role="status" aria-live="polite"` so tool changes are announced once per
  change (never per frame); the canvas has an `aria-label` describing the
  current tool. Full keyboard painting and screen-reader painting are Phase 4
  (§13.3).

---

## 8. State Management

### 8.1 Design goal

The canvas/brush engine and the sync engine must update **without UI
re-renders**. The UI is a thin, passive observer of a tiny mutable state core.
There is no React, no store library, no immutability machinery — just a typed
event bus and a mutable `AppState` object read by reference.

### 8.2 Core state object

```ts
// core/state/AppState.ts (shape)
interface AppState {
  activeSegment: Segment | null;   // current tool window
  activeSegmentIndex: number;      // index into SegmentStore (−1 before ready)
  activeTool: ToolConfig | null;   // resolved tool params (denormalized)
  syncEnabled: boolean;            // follow-time vs free paint
  audioMuted: boolean;
  playerState: PlayerState;        // "unstarted"|"playing"|"paused"|"ended"|...
  currentTime: number;             // last known time (for HUD/next countdown)
  timeToNext: number;              // seconds until next segment (HUD, §5.4)
  nextSegment: Segment | null;     // lookahead (from §5.4)
  baseHasPaint: boolean;           // dirty flag: enables Clear confirm (§7.7)
  brushEngine: BrushEngine;        // reference to engine (imperative handle)
}
```

`AppState` is a singleton mutated in place. The sync engine, video wrapper, and
control bar all read/write it directly. Only the `tool:change` and
`player:*` bus events trigger the HUD/control-bar *text* updates; nothing
else subscribes to per-frame changes.

### 8.3 Event bus

`core/state/eventBus.ts` is a minimal typed emitter:

```ts
type Events = {
  "tool:change": { prev: ToolConfig | null; next: ToolConfig | null };
  "player:state": { state: PlayerState };
  "player:seek": { time: number };
  "sync:toggle": { enabled: boolean };
  "audio:toggle": { muted: boolean };
  "script:error": { message: string };
};
```

- **Who emits:** SyncEngine (tool/player/seek), YouTubePlayer (player state),
  ControlBar (sync/audio toggles), loader (script error).
- **Who subscribes:** ToolHud (`tool:change`), ControlBar (`sync:toggle`,
  `audio:toggle`, `player:state`), VideoWindow (`player:state`), and a thin
  `AppState` reconciler that copies event payloads into `AppState` for the
  render loop to read by reference.
- **Hard rule:** the render loop never subscribes to the bus. It reads
  `AppState` directly each frame. The bus is only for *discrete UI-visible*
  changes.

### 8.4 Sync-engine → canvas flow (the hot path)

```
YouTubePlayer (IFrame API)
        │  getCurrentTime()
        ▼
SyncEngine.tick()  [throttled ~4 Hz]
        │  binary search SegmentStore
        ▼
activeTool changes?  ──yes──▶ AppState.activeTool = tool
        │                         │  (mutable, by reference)
        │                         ▼
        │              emit "tool:change"  ──▶ ToolHud updates text (≤2 Hz)
        ▼
Render loop (rAF, every frame):
    reads AppState.activeTool + AppState.brushEngine
    applies current Brush to pointer stroke
    draws base → visible + effects + cursor
```

Key property: a tool change is a **single object assignment** (`AppState.
activeTool = next`), read on the next frame. There is no reconciliation, no
selector, no diff, no GC pressure from re-created objects (the `Brush` objects
are singletons).

### 8.5 Imperative handles

- `BrushEngine` exposes imperative methods: `beginStroke(p)`, `move(p)`,
  `endStroke()`, `clear()`, `setTool(tool)`. The render loop and pointer
  handlers call these directly.
- The YouTube wrapper exposes `play/pause/seek/mute` imperatively.
- If the app later migrates to React, these are exactly the methods exposed via
  `useImperativeHandle`/refs; nothing in the engine depends on the DOM layer.
  This is the bridge that makes the vanilla choice future-proof (§2.2).

### 8.6 What re-renders, what doesn't

| Concern | Mechanism | Frequency |
|---------|-----------|-----------|
| Active tool (canvas behavior) | `AppState.activeTool` ref read per frame | per frame (no DOM) |
| Tool HUD text | bus `tool:change` → textContent | only on change |
| Control bar button states | bus events → class toggles | only on change |
| Video window position | direct style mutation during drag | during drag only |
| Canvas pixels | Render loop | every frame (necessary) |
| Particles/cursor | Render loop | every frame (necessary) |

---

## 9. Performance Plan

### 9.1 The 60 FPS budget

Frame budget is **16.6 ms** (60 FPS). Per-frame breakdown target:

| Stage | Target | Notes |
|-------|--------|-------|
| Time/sync eval (amortized) | < 0.1 ms | only 4×/s, amortized ~0.02 ms |
| Pointer → smoothed samples | < 0.2 ms | O(points), points bounded |
| Active brush draw (base) | < 2 ms | stamps use cached sprites |
| Base → visible blit | < 2 ms | single `drawImage` (DPR-scaled) |
| Particles + cursor | < 0.5 ms | capped count |
| Headroom | ~12 ms | for GC/browser variance |

### 9.2 DPR (device pixel ratio) handling

- The visible canvas backing store is sized `width = cssW * dpr`,
  `height = cssH * dpr`, and the context is scaled by `dpr` (capped at `2` to
  avoid 3×/4× mobile blowups).
- The **base (offscreen) canvas** is sized at the same capped-DPR resolution so
  Save PNG is crisp.
- All drawing math happens in CSS pixels; `ctx.scale(dpr, dpr)` translates to
  device pixels. The blit is `drawImage(base, 0, 0, cssW, cssH)` which is a
  scaled copy — fast, and DPR-correct.
- On `devicePixelRatio` change (zoom / monitor move), re-size both canvases and
  re-blit; the base content scales (mild resample is acceptable in MVP).

### 9.3 Memory & allocation discipline

- **No per-frame allocations** in the hot path: vectors/points are reused from
  a small pool; smoothed-sample arrays are re-sliced, not reallocated.
- **Stamp sprites** (radial gradient for soft brushes, needle clusters for fan,
  fleck tiles for knife) are pre-rendered once per (tool params) and cached in a
  `Map` keyed by `color|size|opacity|type`. Cache is bounded (~32 entries, LRU)
  so a long episode with many tool segments cannot leak.
- **Stroke points** are capped (e.g., 2048 points/stroke); beyond that, older
  points are merged. This bounds per-stroke memory.
- **Particle pool** capped at 256; the oldest particle is recycled when full.
- On **Clear Canvas**, the base is reset and caches are kept (they are keyed by
  tool params and reusable).

### 9.4 Touch / mobile

- **Input:** Pointer Events unify mouse/touch/pen. `touch-action: none` on the
  canvas prevents scroll/pinch hijacking while painting.
- **DPR cap at 2** keeps mobile backing stores sane.
- **Lighter physics on small screens:** reduce particle cap to 128 and stamp
  `spacing` scales with `size` so small brushes don't spam stamps.
- **Mobile is best-effort** per §1.4: layout works in landscape; portrait shows
  the video docked smaller and the canvas letterboxed. Primary target is
  desktop/tablet.

### 9.5 Avoiding jank

- The IFrame API callback and all bus handlers are O(1) and never touch canvas.
- Long-lived objects (brushes, stores, caches) are created at startup, not
  during playback.
- If a frame overruns (dev-only warning), the render loop logs once and
  continues; there is no per-frame console spam.
- Web Workers are **not** used in MVP (Canvas2D can't easily offload strokes),
  but the sync *evaluation* is cheap enough to stay on the main thread.

---

## 10. Milestones (M0 → M7)

Each milestone lists deliverables and **testable acceptance criteria**. A
milestone is done only when every box is checked on a clean checkout.

### M0 — Repo scaffold & build
- **Deliver:** Vite + strict TS project; ESLint/Prettier/Vitest; `index.html`
  with the dark-room shell and an empty canvas.
- **Acceptance:**
  - [ ] `npm run dev` serves and shows a dark full-bleed canvas at ≥80% viewport.
  - [ ] `npm run build` exits `0` and emits `dist/`.
  - [ ] `npm run lint`, `npm run typecheck`, `npm test` all exit `0`.
  - [ ] `tsconfig.json` has `"strict": true` and `noUncheckedIndexedAccess` (or a
        documented reason it is off).
  - [ ] A deliberate type error fails `typecheck` (guard test).

### M1 — Data layer & validation
- **Deliver:** `types/script.ts`, `data/script.schema.ts`, loader, and
  `data/s01e01.json` (canonical 19 segments, §4.4).
- **Acceptance:**
  - [ ] `s01e01.json` parses and validates; `timeline.length === 19`,
        `timeline[0].startTime === 0`, `timeline[18].endTime === 1665`.
  - [ ] Contiguity check passes: `timeline[i].startTime === timeline[i-1].endTime`
        for all `i` (no gaps/overlaps).
  - [ ] Canonical type histogram is exactly
        `{liquid_white_base:2, sky_wash:4, pine_tree_foliage:8, mountain_snow:5}`.
  - [ ] `tests/fixtures/invalid.script.json` is rejected with the expected Zod
        `path` for each mutated field (bad hex, reversed endTime, overlap,
        unknown type, negative time) — one focused assertion per mutation.
  - [ ] Loader's fallback path yields a playable neutral tool on invalid input
        (asserted, not just logged).

### M2 — YouTube integration & sync engine
- **Deliver:** `YouTubePlayer.ts` (IFrame API) + `SyncEngine` (hybrid cadence,
  lookahead, seek/end) + `SegmentStore`.
- **Acceptance:**
  - [ ] With a **fake TimeSource** (no network), tests prove `indexAt` boundary
        semantics at every canonical boundary: `t = startTime → segment i`;
        `t = endTime → segment i+1`; `t < 0 → segment 0`; `t > 1665 → segment 18`.
  - [ ] Test drives a fake clock across `131/218/252/292/368/490/555/599/881/949/1025/1081/1125/1233/1306/1409/1456/1616`
        and asserts exactly one `tool:change` per crossing (anti-flap).
  - [ ] Hybrid-cadence test: ≥ 250 ms between evaluations mid-segment, and
        ≤ 1 frame between evaluations when `timeToNext ≤ 400 ms`.
  - [ ] Seek test: a seek to `t = 900 s` resolves to segment 10
        (`mountain_snow`/`Palette Knife`) within one frame.
  - [ ] End test: `video:ended` holds segment 19 and enters finish mode.
  - [ ] Manual: HUD badge updates to the canonical segment names as the real
        `oh5p5f5_-7A` video plays; pause freezes, resume continues.

### M3 — Brush engine (four tools)
- **Deliver:** all four `Brush` implementations + `interpolation.ts` +
  sprite cache, drawing onto the offscreen base.
- **Acceptance:**
  - [ ] `interpolation.test.ts`: samples are uniformly spaced within `±1%` of
        `step`; no `NaN` on duplicate/consecutive-identical points; fast-sweep
        tracking does not overshoot beyond `0.5 × size`.
  - [ ] No-op test: a `liquid_white_base` stroke with `opacity: 0` leaves the
        base checksum unchanged.
  - [ ] Mode-selection test: `pine_tree_foliage` at `size=12` takes the ribbon
        path and at `size=25` takes the cluster path (assert via a spy).
  - [ ] Blend test: a `screen` knife stroke (segment 13) raises the mean
        luminance of the touched region, while a `multiply` wash (segment 3)
        lowers it.
  - [ ] Manual QA per §12.2 checklist for each of the four tools; screenshots
        captured to `docs/qa/` as regression artifacts.
  - [ ] Frame-time during a pinned-tool drag: p95 < 16.6 ms (Chrome + Firefox).

### M4 — Render loop, compositor, cursor, particles
- **Deliver:** two-layer renderer, DPR handling, per-tool cursor, capped
  ripple/particle effects.
- **Acceptance:**
  - [ ] `p95` frame time < 16.6 ms over a 10 s scripted fast drag on
        Chrome and Firefox (headless measurement harness).
  - [ ] Cursor glyph changes per `tool.type` and its footprint matches
        `tool.size` within ±2 CSS px.
  - [ ] Particle count never exceeds the cap (256 desktop / 128 mobile) under a
        10 s continuous stroke (asserted via an exposed counter).
  - [ ] Base and visible canvases are sized `css × min(dpr, 2)` and remain
        pixel-aligned after a simulated DPR change (zoom) and window resize.
  - [ ] Clear resets the base; Save PNG downloads a non-blank image whose
        dimensions equal the capped-DPR backing store.

### M5 — UI polish & controls
- **Deliver:** draggable/dockable video window, HUD with "next" countdown,
  control bar, toasts, keyboard shortcuts, responsive breakpoints (§7.7–7.9).
- **Acceptance:**
  - [ ] All controls function from both mouse and the §7.7 keyboard map; hidden
        HUD/`?` overlay toggles with `H`.
  - [ ] Dev DOM-mutation counter shows **zero** writes during 5 s of continuous
        painting and **≤ 2** per tool change (HUD) — proving no per-frame UI
        writes.
  - [ ] Video window drag is clamped in-bounds at all three breakpoints; snap
        works; minimize/restore preserves `currentTime`.
  - [ ] Script-load failure and YouTube failure both surface the correct
        notice and leave the canvas usable (simulated via injected faults).
  - [ ] `role="status"` HUD announces exactly one tool name per change (manual
        screen-reader check).

### M6 — Verification pass (MVP sign-off)
- **Deliver:** evidence bundle under `docs/qa/` + the multimodal validation run
  (§11.2).
- **Acceptance:**
  - [ ] All four brief criteria pass per §11 on desktop Chrome + Firefox and one
        tablet (landscape).
  - [ ] §11.2 visual comparison produces, at minimum, a per-segment composite
        scorecard with no "severe mismatch" on the four MVP tools.
  - [ ] Zero P0/P1 bugs open; all M0–M5 acceptance boxes re-verified on a clean
        checkout at the release commit.

### M7 — Release prep (deferred until GitHub publication authorized)
- **Deliver:** CI workflow, README, LICENSE.
- **Acceptance:**
  - [ ] `npm run ci` (lint + typecheck + test + build) green on Node LTS.
  - [ ] README quickstart reproduces `npm run dev` from a fresh clone.
  - [ ] No secrets/keys committed (`grep`-based check in CI).

---

## 11. Mapping: Spec's 4 MVP Verification Criteria → Test Procedures

| # | Spec criterion | Concrete test procedure | Owner / milestone |
|---|----------------|-------------------------|-------------------|
| 1 | *App presents a playable YouTube video in a floating PiP window + full-bleed canvas* | Load app in Chrome. Assert: (a) canvas fills ≥80% viewport; (b) video window visible bottom-right, draggable within bounds; (c) pressing Play starts `oh5p5f5_-7A` with audio; (d) window minimizes/restores. | M2 + M5 |
| 2 | *Play auto-syncs the active tool configuration* | With DevTools console open, start video; assert `AppState.activeTool.name` transitions through the canonical names at `t = 0` (`Intro — no paint`), `131` (`2½-inch Brush`), `218` (`2-inch Brush`/sky), `368` (tree shapes), `881` (`Palette Knife`), `1616` (`Script Liner`). HUD text must match within ≤250 ms mid-segment and ≤1 frame when entering a boundary band (`timeToNext ≤ 400 ms`). Verify pause freezes the tool; seek to `900 s` sets `Palette Knife` immediately. | M2 |
| 3 | *Dragging at 01:30 paints broad blue sky strokes; at 04:30 paints pine fan or knife snow* | **Timestamp remap:** the brief's literal `01:30`/`04:30` came from the placeholder video and do not match the canonical episode; test the *intent* at canonical times. Seek `235 s` (segment 3, `sky_wash`, Cad-yellow, `multiply`) drag → broad soft yellow/blue wash, feathered edges, tint over white. Seek `270 s` (segment 4, Prussian blue `multiply`). Seek `400 s` (segment 6, `pine_tree_foliage`, size 25) → needle-cluster stamps. Seek `900 s` (segment 10, `mountain_snow`, `source-over`) → crisp brown breaking-edge knife path. Seek `1100 s` (segment 13, `mountain_snow`, `screen`) → sheen that *lightens*. Seek `1630 s` (segment 19, `Script Liner`, `breakTexture:false`) → crisp continuous signature line. Capture a screenshot per case as a regression artifact. | M3 |
| 4 | *Canvas feels liquid, responsive, smooth, relaxing* | (a) Automated: run a scripted fast drag; assert frame time p95 < 16.6 ms over 10 s (Chrome Performance panel / `requestAnimationFrame` delta sampling). (b) Manual: rapid circular sweeps show no jaggedness (bezier smoothing) and no cursor lag. (c) Subjective: no UI flicker; strokes build gradually (wet-on-wet). | M4 + M6 |

### 11.1 Acceptance mapping summary

The acceptance criteria in §10 reference these procedures; M6 runs all four as
the official MVP gate. Screenshots from criterion 3 are stored under
`docs/qa/` (gitignored in MVP, retained locally) as visual regression evidence.

### 11.2 Multimodal validation (screenshot ↔ video frame)

This is a first-class verification loop, not an afterthought: because the agent
building the app is multimodal, it can **screenshot the rendered canvas, pull the
matching video frame, and compare them** (visually and quantitatively) to
validate and improve brush fidelity, cursor/HUD placement, and color. It
complements — never replaces — the programmatic tests above.

**Goal:** for a given canonical segment, a scripted stroke on a clean canvas
should produce a region whose *color, edge character, and texture statistics*
resemble what Bob's paint does at that same episode moment, and the UI chrome
should match the intended layout.

**Pipeline (per segment):**

1. **Deterministic capture.** A Playwright (or Puppeteer) driver:
   - loads the app in a fixed viewport (`1280×720`, `dpr=1` for comparability),
   - calls the dev hook `window.__bob.pinTool(segmentIndex)` (bypasses sync),
   - draws a **fixed reference gesture** (same path/speed for every run) via
     synthetic pointer events,
   - screenshots the *base* canvas (`canvas.toDataURL`), saving
     `docs/qa/segment-<n>-canvas.png`.
2. **Reference frame.** Extract the video frame nearest the segment's midpoint
   with `ffmpeg` (or the YouTube thumbnail API as a coarse fallback):
   `ffmpeg -ss <t> -i episode.mp4 -frames:v 1 docs/qa/segment-<n>-frame.png`.
   The frame is cropped to the painting region (fixed crop box per episode).
3. **Quantitative compare.** Compute region metrics between the user-canvas crop
   and the reference crop:
   - mean/σ per RGB channel and ΔE (CIE76) on the dominant color;
   - edge density (Sobel energy) and high-frequency energy (Laplacian variance)
     to measure "breaking"/texture;
   - a structural score (SSIM) and, when available, a perceptual metric (LPIPS).
   Emit a `segment-<n>-metrics.json`.
4. **Visual (model) review.** Pass both images plus the hot-words prompt below
   to the multimodal model and record a verdict + concrete parameter deltas.
5. **Improve.** Apply the suggested deltas to the brush JSON/sprite parameters
   (e.g., `spacing`, `flow`, needle count, fleck density), re-run step 1, and
   keep the change only if the metrics score improves (guardrail: no regression
   on prior segments).

**Prompt template for the visual review:**

> "Left: Bob Ross's actual canvas at [mm:ss] of 'A Walk in the Woods'. Right:
> our generated canvas using the `${type}` brush with `${color}` at size
> `${size}`. Focus on the painted region only. Rate color match, edge
> softness/hardness, and texture (breaking/grain) from 0–5 each. List the 2–3
> most visible mismatches and suggest concrete parameter changes
> (`spacing`/`flow`/`size`/needle count/fleck density/blend mode). Ignore
> composition differences caused by the user's gesture."

**Acceptance / guardrails:**

- [ ] Every canonical segment has a captured canvas + reference frame + metrics
      JSON in `docs/qa/` (M6 evidence bundle).
- [ ] No segment scores below the "severe mismatch" threshold (ΔE > 20 on the
      dominant color) for the four MVP tools.
- [ ] `screen` segments (5, 8, 13, 15) must show a positive luminance delta vs.
      their pre-segment frame; `multiply` segments (3, 4, 12) a negative one.
- [ ] The loop is **advisory in MVP**: it files findings and tuning diffs but
      does not block the build. Human review signs off before changing shipped
      parameters.
- [ ] Reference frames are only used for local QA; nothing copyrighted is
      committed to the repo (keep `docs/qa/` gitignored, as already stated).


---

## 12. Testing Strategy, Risks, & Open Questions

### 12.1 Unit tests (Vitest)

| Module | What is tested | Key cases |
|--------|----------------|-----------|
| `schema.test.ts` | Zod validation | valid script passes; bad hex color, reversed `endTime`, overlapping segments, unknown `type`, negative time all rejected with correct `path` |
| `segmentStore.test.ts` | Binary search + store build | exact boundary (t = startTime → this segment; t = endTime → next), t before first, t after last, contiguity check |
| `syncEngine.test.ts` | Sync logic (fake TimeSource) | boundary crossing emits `tool:change` once; hybrid cadence (≥250 ms mid-segment, per-frame in band); contiguous canonical boundary sweep; pause freezes; seek re-evals; implicit-seek on non-monotonic jump; buffering holds; end holds last tool; sync-off freezes |
| `interpolation.test.ts` | Bezier sampling | smooth polyline passes through midpoints; sample spacing ≈ `step` (±1%); no NaNs on duplicate points; fast-sweep tracking |
| `brushes.test.ts` | Brush behavior | `opacity:0` is a base-pixel no-op; `pine_tree_foliage` chooses ribbon at `size<18` / cluster at `size>=18`; `screen` raises and `multiply` lowers mean luminance; sprite cache keyed correctly and bounded |
| `multimodal.test.ts` (optional, local-only) | Metric helpers | ΔE / edge-energy / luminance-delta math is correct on synthetic images; skipped in CI when reference frames are absent |

The sync engine and schema are the two highest-value, most-testable units; the
brush *feel* is covered by manual QA (§12.2), not unit tests.

### 12.2 Manual QA (brush feel)

Brush realism is a perceptual property and cannot be asserted numerically at
this fidelity. Manual QA checklist per tool:

- **liquid_white_base:** translucent coat builds gradually; no hard stamp edges;
  criss-cross texture visible; no visible gaps on slow drags.
- **sky_wash:** feathered edges; `multiply` tint over white base; speed affects
  density (slow = more pigment).
- **pine_tree_foliage:** needle clusters look organic; no two taps identical;
  foreground occludes background foliage.
- **mountain_snow:** crisp tapered edge; break texture (flecks) visible; noise
  makes the edge irregular, not vector-clean.

Procedure: load a dev fixture that pins each tool (bypass sync), drag in a
fixed pattern, capture a screenshot, and eyeball against the checklist. Repeat
on Chrome, Firefox, and one tablet.

### 12.3 Lint & CI

- **Local:** `npm run lint` (ESLint) + `npm run typecheck` (tsc --noEmit) +
  `npm test` (Vitest) + `npm run build` (Vite).
- **CI:** `.github/workflows/ci.yml` runs the same four steps on push/PR. This
  is authored in M0 but only enabled once GitHub publication is authorized
  (out of scope for the MVP workstream itself).

### 12.4 Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| YouTube IFrame API unavailability (embed disabled on some videos) | Med | High | Detect `onError`; show fallback message; scripted fake player keeps dev/test green |
| Autoplay/audio policy blocks playback | Med | Med | No autoplay by design; require explicit Play; audio toggle only after gesture |
| Brush realism falls short of "Bob" feel | Med | High | Iterate stamp params (spacing/flow/falloff); keep brush params data-driven so tuning is JSON-only |
| Perf drops below 60 FPS on large canvases | Med | High | Two-layer compositor + sprite caching + DPR cap; perf budget in §9 with p95 gate |
| Script timestamps drift from the real video | High | Med | Timestamps are hand-tuned in a QA pass; sync is absolute-time so no cumulative drift; segments wide enough to tolerate ±2 s |
| React migration later is blocked by vanilla choices | Low | Low | Imperative-handle architecture (§8.5) is React-compatible |
| Scope creep (more tools/episodes before MVP) | Med | Med | §1.3/1.4 boundaries enforced; new tool types are Phase 2 |

### 12.5 Unknowns / open questions

**Resolved (see Addendum):**

1. **Embedding for `oh5p5f5_-7A`** — the owner confirmed embedding is allowed
   (2026-10-05); no fallback video needed. Keep an `onError` notice anyway as a
   defensive measure.
2. **Exact segment timestamps** — canonical timings are transcript-derived and
   captured in `src/data/s01e01.json` (19 segments, §4.4); they still get a
   final ±1 s alignment pass against the video during M2/§11.2.

**Open:**

1. **How much "wet" realism is enough for MVP?** The Canvas2D alpha/multiply
   model may read as flat compared to real wet-on-wet mixing; the MVP bar is
   "relaxing and believable," not photoreal. Confirm the threshold empirically
   in M3 via the §11.2 scorecard rather than by debate.
2. **Velocity response curve for knife flecks and wash density** — currently
   defined as linear (`flow`, `v/v_ref`). Whether a quadratic or clamped curve
   reads better is a tuning question for M3; the formula is isolated so it can
   be swapped without touching stroke geometry.
3. **`OffscreenCanvas` availability** across target browsers — a detached
   `document.createElement('canvas')` fallback is implemented from the start
   (M3/M4), so this is a perf, not a correctness, question.
4. **Needle-cluster density** for `pine_tree_foliage` — the `n = lerp(7,11,…)`
   default is a starting point; tune against §11.2 for segments 6/9/11/16/18.
5. **Short-segment HUD churn** — segments 3 (34 s) and 8 (44 s) can make the
   "next" countdown jumpy if a user scrubs; confirm the anti-flap + throttled
   countdown feel calm in M5.

---

## 13. Future Phases (post-MVP)

### 13.1 Phase 2 — WebGL shading & realism

- Migrate the brush renderer to WebGL (via a WebGL backend behind the same
  `Brush` interface).
- Add fluid/paint simulation (Navier-Stokes or simpler paint-flow shaders) for
  true wet-on-wet pigment mixing.
- Crisp dry-oil breaking via fragment shaders (procedural noise) instead of the
  dash-and-fleck approach.
- Pressure/tilt/stylus support and higher-DPR (retina 2×+) canvases.
- Additional blend modes (screen/lighter already reserved in §6.7).

### 13.2 Phase 3 — Content & community

- More episodes (Season 1+): each with its own authored, validated script.
- A script editor/authoring UI so the community can write and share
  timestamped scripts (with the Zod schema as the shareable contract and a
  validation step on import).
- A gallery to save/persist user paintings (canvas → PNG → storage), with
  export/share.
- Undo/redo history and layer concepts (wet-on-wet layering formalized).

### 13.3 Phase 4 — Polish & distribution

- Localization/i18n, accessibility (keyboard painting, screen-reader tool
  announcements), offline/PWA packaging, and performance work for low-end
  mobile.

### 13.4 Open-source publishing (gated)

- LICENSE selection, README/screenshots, and CI/CD are prepared in M7 but the
  actual GitHub publication is explicitly deferred until the owner authorizes
  it — this repo is not to be pushed in the MVP workstream.

---

## Appendix A — Acceptance mapping (condensed)

| MVP verification criterion (§spec) | Procedure | Milestone gate |
|------------------------------------|-----------|----------------|
| Playable floating video + full-bleed canvas | §11 row 1 | M2 + M5 |
| Play auto-syncs active tool | §11 row 2 | M2 |
| Broad sky wash / pine clusters / knife breaking edge (brief's 01:30–04:30 intent, remapped to canonical times per §11 row 3) | §11 row 3 (screenshots + §11.2 scorecard) | M3 |
| Liquid, smooth, relaxing feel | §11 row 4 (p95 < 16.6 ms) | M4 + M6 |

All four are executed together as the official MVP sign-off in M6.

---

## Addendum — 2026-10-05: canonical video + real script

- **Canonical video id:** `oh5p5f5_-7A` ("A Walk in the Woods") —
  https://www.youtube.com/watch?v=oh5p5f5_-7A. Supersedes the placeholder
  `OH94B9B8zDk` from the brief.
- **Transcript archived:** `docs/bob-transcript-s01e01.txt` (chaptered,
  with per-line timestamps).
- **Script authored:** `src/data/s01e01.json` — **19** contiguous,
  non-overlapping segments covering **0–1665 s**, derived from the transcript's
  real timings and mapped to the four MVP tool types (plus blend modes +
  tool-specific knobs). Boundaries: `0, 131, 218, 252, 292, 368, 490, 555, 599,
  881, 949, 1025, 1081, 1125, 1233, 1306, 1409, 1456, 1616`; final `endTime`
  `1665`. *(An earlier revision of this addendum said "20 segments"; the
  authoritative JSON has 19 — corrected throughout the plan.)*
- **Open question 2 (real segment timestamps):** resolved by the above; the
  timings are transcript-derived and should still get a final pass against the
  actual video during M2.
- **Open question 1 (embedding allowed?):** RESOLVED — owner confirmed the
  video `oh5p5f5_-7A` supports embedding (2026-10-05). No fallback needed.

## Addendum — 2026-10-05: plan revision pass

Revised in place to (1) reconcile every video id, segment count, timing and
tool-type mapping with `src/data/s01e01.json` (19 segments / `oh5p5f5_-7A`);
(2) add concrete formulas/pseudocode to the brush engine (§6.2–6.6) and a
reference sync tick (§5.8); (3) close sync-engine edge cases (§5.5) and UI gaps
(§7.7–7.9); (4) add the multimodal screenshot↔frame validation loop (§11.2);
and (5) give every milestone M0–M7 testable acceptance criteria (§10). The 13
top-level sections are unchanged; the multimodal work lives under §11 and the
existing Appendix A mapping is unchanged in intent.
