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

- Single episode (`s01e01`, "A Walk in the Woods", YouTube ID `OH94B9B8zDk`).
- A hand-authored, validated timestamped tool script for that episode.
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
│   └── IMPLEMENTATION_PLAN.md        # This document
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
    │   ├── syncEngine.test.ts        # Segment lookup, drift, seek, end behavior
    │   ├── segmentStore.test.ts      # Binary search, boundary cases
    │   ├── schema.test.ts            # Zod validation of s01e01.json + fixtures
    │   └── interpolation.test.ts     # Bezier sampling invariants
    └── fixtures/
        ├── valid.script.json         # Minimal valid script
        └── invalid.script.json       # Deliberately broken (for schema tests)
```

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

### 4.3 Validation of the spec's example script

The brief's example script is **mostly valid** but has one gap and two
ergonomics issues our schema addresses:

1. **Coverage gap.** The timeline covers `0–600` seconds, but no segment
   covers the final seconds and there is no "end" marker. Our engine treats
   `endTime` of the last segment as the end; the spec's last segment ends at
   600, so playback past 600s would leave the *last* tool active (acceptable)
   but the engine must define this (§5.5).
2. **First segment starts at 0** — valid. All segments are contiguous and
   non-overlapping (`120/240/420` boundaries align). ✅
3. **All four MVP tool types are represented** in the example. ✅
4. **Blend modes valid** — `source-over` and `multiply` are both in the allowed
   set. ✅
5. **Missing extras.** No `flow`, `spacing`, or `breakTexture` beyond the knife
   segment. These are optional, so the example still passes; our fuller script
   adds them for richer brush feel.

The example validates against the Zod schema as written (with `version` absent,
which is allowed). We keep the schema backward-compatible with the spec's
fields.

### 4.4 Fuller s01e01 script (proposal)

Below is an expanded `s01e01.json` with more segments and tool knobs. It
mirrors the general arc of "A Walk in the Woods": liquid white base → sky wash
→ background trees → mountain snow → foreground evergreens → highlights. Times
are illustrative and tuned during a real pass against the video (§11, §12).

```json
{
  "videoId": "OH94B9B8zDk",
  "title": "A Walk in the Woods",
  "version": 1,
  "timeline": [
    {
      "startTime": 0,
      "endTime": 90,
      "tool": {
        "name": "2-inch Brush",
        "color": "#FFFFFF",
        "type": "liquid_white_base",
        "opacity": 0.08,
        "size": 60,
        "flow": 0.6,
        "blendMode": "source-over"
      },
      "bobDialogue": "We start with a thin coat of Liquid White..."
    },
    {
      "startTime": 90,
      "endTime": 210,
      "tool": {
        "name": "2-inch Brush",
        "color": "#2C5282",
        "type": "sky_wash",
        "opacity": 0.35,
        "size": 50,
        "flow": 0.8,
        "blendMode": "multiply"
      },
      "bobDialogue": "Load up some Phthalo Blue for a happy little sky..."
    },
    {
      "startTime": 210,
      "endTime": 300,
      "tool": {
        "name": "2-inch Brush",
        "color": "#F6E7C1",
        "type": "sky_wash",
        "opacity": 0.3,
        "size": 45,
        "flow": 0.8,
        "blendMode": "multiply"
      },
      "bobDialogue": "A touch of Titanium White where the light lives..."
    },
    {
      "startTime": 300,
      "endTime": 430,
      "tool": {
        "name": "Fan Brush",
        "color": "#1A365D",
        "type": "pine_tree_foliage",
        "opacity": 0.85,
        "size": 25,
        "spacing": 0.6,
        "flow": 0.7,
        "blendMode": "source-over"
      },
      "bobDialogue": "Tap in some background evergreens with the fan brush..."
    },
    {
      "startTime": 430,
      "endTime": 560,
      "tool": {
        "name": "Palette Knife",
        "color": "#CBD5E0",
        "type": "mountain_snow",
        "opacity": 1.0,
        "size": 15,
        "breakTexture": true,
        "flow": 0.5,
        "blendMode": "source-over"
      },
      "bobDialogue": "Whisper across with the palette knife for the snow..."
    },
    {
      "startTime": 560,
      "endTime": 700,
      "tool": {
        "name": "Fan Brush",
        "color": "#22543D",
        "type": "pine_tree_foliage",
        "opacity": 0.9,
        "size": 30,
        "spacing": 0.5,
        "flow": 0.7,
        "blendMode": "source-over"
      },
      "bobDialogue": "Darker foreground evergreens, right here..."
    },
    {
      "startTime": 700,
      "endTime": 820,
      "tool": {
        "name": "Palette Knife",
        "color": "#FFFFFF",
        "type": "mountain_snow",
        "opacity": 0.95,
        "size": 12,
        "breakTexture": true,
        "flow": 0.4,
        "blendMode": "source-over"
      },
      "bobDialogue": "Bright highlights on the happy little trees..."
    }
  ]
}
```

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

**Decision: `requestAnimationFrame` for the render loop; a dedicated
`setInterval(100ms)` for the time source is *not* needed — we poll inside the
existing rAF loop, but time-sampled at a throttled cadence.**

Concretely:

- The main rAF loop runs every frame (~16.6 ms) for painting/compositing.
- The sync *evaluation* (calling `getCurrentTime()` and doing segment lookup)
  is throttled to **~4×/second (every 250 ms)** using a monotonic
  `lastSyncAt` timestamp inside the loop. Segment boundaries are multi-second
  windows; 250 ms granularity is visually indistinguishable and dramatically
  cheaper than per-frame polling.
- The brief suggests "rAF or setInterval at 100ms." We choose **throttled rAF**
  because it avoids a second timer, shares the existing frame budget, and never
  stacks up behind a busy main thread the way a free-running interval can.

Rationale for the throttle value:

| Poll cadence | Segment-lookahead cost | Boundary latency | Verdict |
|--------------|------------------------|------------------|---------|
| every frame | trivial but unnecessary | <16 ms | overkill |
| 100 ms | 10/s | ≤100 ms | fine, but separate timer |
| **250 ms** | 4/s | ≤250 ms | **chosen: imperceptible, cheapest** |

### 5.4 Segment lookahead

The engine maintains:

- `activeSegment` — the segment containing `currentTime`.
- `nextSegment` — the segment after `activeSegment` (the lookahead target).
- `timeToNext` — `nextSegment.startTime - currentTime`, clamped ≥ 0.

This lookahead serves two purposes:

1. **HUD pre-warning** — the tool badge can show "next: Fan Brush in 12s"
   (subtle), which aids the relaxing UX without interrupting.
2. **Pre-warming** — the brush engine can pre-allocate/prepare the next
   brush's parameters (e.g., precompute stamp sprites) during idle frames, so
   the switch at the boundary is instant and causes no frame hitch (§6, §9).

Lookahead is recomputed on every sync evaluation (cheap: one integer index).

### 5.5 Boundary, drift, and lag handling

- **Segment lookup** — binary search over `store.flat` by `startTime`; returns
  the segment whose `[startTime, endTime)` contains `t`.
- **Contiguity** — the store guarantees ordered, non-overlapping segments; gaps
  are disallowed by the schema. If a gap is ever introduced by a hand edit, the
  engine falls back to the *previous* segment's tool until the next segment
  begins (never leaves "no tool").
- **Drift correction** — `getCurrentTime()` is authoritative; we never
  accumulate a local offset. If the video stalls/buffers, the time source stops
  advancing, so the engine naturally holds the current tool — no desync.
- **Lag (missed boundaries)** — because we poll at 250 ms and re-evaluate by
  absolute time (not by incrementing a counter), a delayed frame still resolves
  to the *correct* segment for the current `currentTime`. There is no drift
  accumulation. Boundary crossing is therefore always ≤ one poll period late
  and self-corrects on the next tick.
- **Seek** — on `video:seek` (or a detected non-monotonic `currentTime` jump
  > 1.5 s), the engine re-evaluates immediately and emits `tool:change` if the
  segment changed. This prevents a stale tool after scrubbing.
- **End** — on `video:ended` (or `currentTime` ≥ store.duration), the engine
  emits `video:ended`; painting is left enabled so the user can keep adding
  strokes with the last tool (a pleasant "finish your painting" moment), and
  the HUD switches to a "finish mode" hint.

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

- **Bezier smoothing** — given raw points `p0, p1, p2`, the midpoint between
  `p0,p1` and `p1,p2` becomes the control points of a quadratic curve. This
  removes jitter without lag; for fast sweeps we reduce control-point offsets
  proportional to speed so the path tracks the pointer instead of overshooting.
- **Wet-on-wet layering** — every stroke draws onto a persistent **offscreen
  base canvas** using the tool's `globalCompositeOperation` and `globalAlpha`.
  Because wet-on-wet mixes already-laid paint with new strokes, we rely on the
  canvas's own alpha compositing (and `multiply` for translucent washes) rather
  than trying to model physical pigment mixing. `flow` modulates opacity per
  stamp so repeated passes build up density like real wet-on-wet layering.
- **Opacity falloff** — soft brushes modulate per-stamp alpha by a radial
  falloff function (linear or gaussian) so edges feather instead of hard-clip.

### 6.3 `liquid_white_base` — 2-inch brush, wide soft criss-cross

1. On `beginStroke`, set `globalAlpha = tool.opacity`, `globalCompositeOperation
   = tool.blendMode`.
2. On each extended segment, draw a **soft round stamp** (radial gradient from
   `tool.color` at center to transparent at radius `size/2`) at the smoothed
   position.
3. Stamps are placed at `spacing = size * 0.25` so consecutive stamps overlap
   ~75%, producing a continuous wash.
4. **Criss-cross:** to mimic Bob's back-and-forth application, alternate the
   stamp's ellipse orientation by a slowly varying angle (`sin(time * 0.7)`),
   and apply a slight perpendicular jitter (`± size * 0.08`) so the coat looks
   hand-applied, not a flat fill.
5. Opacity is low (0.05–0.1); repeated drags build the translucent base
   gradually. This is the "thin coat of Liquid White" layer.

### 6.4 `sky_wash` — broad soft wash with opacity falloff

1. Same family as the base but with a **wider, softer** stamp: radius
   `size * 1.4`, gaussian falloff (alpha falls to ~10% at the stamp edge).
2. Blend mode is typically `multiply` (from the script) so the blue wash tints
   the white base rather than covering it — matching Bob's translucent sky wash.
3. Opacity is higher (0.3–0.4) and `flow` scales the per-stamp alpha so a slow
   pass lays more pigment than a fast pass (speed-dependent density).
4. Falloff is recomputed once per stroke and cached as a small offscreen
   **stamp sprite** (a pre-rendered radial-gradient canvas), blitted with
   `drawImage` for speed — the single biggest perf win for soft brushes (§9).

### 6.5 `pine_tree_foliage` — fan brush, procedural stamp clusters

1. The fan brush **stamps**, it does not drag a continuous stroke. On
   `extendStroke`, it places a stamp at each smoothed sample spaced by
   `spacing` (a `size`-relative factor, default 0.5).
2. A single stamp is a **cluster of pine-needle strokes**: a fan of ~7–11 thin
   lines radiating from a common anchor point, drawn in a single path (or from
   a cached sprite). Each needle has slightly randomized length
   (`size * (0.6..1.1)`), angle (`-0.6..0.6 rad` around the fan axis), and
   alpha (`opacity * (0.7..1.0)`).
3. The fan axis is oriented by cursor velocity when available (needles point
   "up" like a pine bough when stationary), and jittered by a seeded PRNG so
   repeated clicks produce varied, natural foliage — no two taps identical.
4. Sprite caching: the needle cluster is pre-rendered once per
   (color, size, opacity) triple and stamped with `drawImage`, rotated per tap
   by the fan angle. This keeps pine stamps O(1) at draw time.
5. Layering: the script runs a light blue-gray "background evergreens" segment
   then a darker green "foreground" segment (§4.4); because stamps accumulate on
   the base canvas with `source-over`, foreground foliage naturally occludes
   background foliage — the wet-on-wet depth effect for free.

### 6.6 `mountain_snow` — palette knife, crisp breaking edge + noise

1. The knife draws a **tapered ribbon**: the stroke width tapers from full
   `size` at the segment center to ~30% at the ends, following the smoothed
   path. This produces the characteristic sharp mountain edge.
2. **Breaking edge:** when `breakTexture` is true, we do *not* fill a solid
   ribbon. Instead we split each ribbon segment into many small flecks: at each
   sample, draw a short 1–3 px dash perpendicular to the path, with the dash
   count and offset driven by a PRNG. Where the path is fast, dashes thin out
   (dry break); where slow, they bunch (heavy paint) — mimicking dry oil
   breaking across canvas texture.
3. **Noise:** add per-dash jitter (length ± 40%, slight rotation ± 0.2 rad) and
   a faint speckle (a few 1 px dots around the edge) so the edge looks crisp but
   irregular, never a clean vector line.
4. Opacity is near 1.0 (knife paint is opaque), and `flow` scales dash density.
   The knife never uses `multiply` — it is always `source-over` snow on top.

### 6.7 Blend modes and wet-on-wet layering

| Mode | Used by | Effect |
|------|---------|--------|
| `source-over` | base, foliage, snow | normal paint-on-top |
| `multiply` | sky wash | translucent tint that darkens/mixes |
| `screen` | (reserved: highlights) | lightening blend for Phase 2 |
| `lighter` | (reserved: additive glow) | additive, for future effects |

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
  (from §5.4 lookahead), e.g. `next: Fan Brush in 12s`, dimmed.

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
  activeTool: ToolConfig | null;   // resolved tool params (denormalized)
  syncEnabled: boolean;            // follow-time vs free paint
  audioMuted: boolean;
  playerState: PlayerState;        // "unstarted"|"playing"|"paused"|"ended"|...
  currentTime: number;             // last known time (for HUD/next countdown)
  nextSegment: Segment | null;     // lookahead (from §5.4)
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

## 10. Milestones (M0 → Mn)

Each milestone has a concrete, verifiable acceptance criterion.

### M0 — Repo scaffold & build
- Vite + strict TS project builds and serves `index.html`.
- ESLint + Prettier + Vitest configured and green (even with a stub test).
- **Acceptance:** `npm run dev` shows a dark full-bleed canvas; `npm test`
  passes a placeholder test; `npm run build` exits 0.

### M1 — Data layer & validation
- `types/script.ts`, `script.schema.ts`, and `s01e01.json` (§4) exist.
- Loader validates `s01e01.json`; invalid fixtures fail with actionable errors.
- **Acceptance:** unit tests assert `s01e01.json` parses, the spec's example
  validates, and `invalid.script.json` is rejected with the correct path.

### M2 — YouTube integration & sync engine
- `YouTubePlayer.ts` loads the IFrame API and plays `OH94B9B8zDk`.
- `SyncEngine` maps `currentTime` → active segment at 250 ms throttle with
  lookahead; handles seek and end.
- **Acceptance:** with a **fake TimeSource** (no network), unit tests prove
  boundary crossing at 120/240/420 s, seek re-eval, and end behavior. Manual:
  HUD badge updates as the real video plays.

### M3 — Brush engine (four tools)
- All four brushes render via the `Brush` interface onto the offscreen base.
- Bezier smoothing, stamp sprites, knife breaking edge, wet-on-wet layering all
  implemented (§6).
- **Acceptance:** manual QA — dragging with a scripted tool produces visibly
  correct textures (broad wash, pine clusters, crisp snow) at 60 FPS; unit test
  for `interpolation.ts` sampling invariants.

### M4 — Render loop, compositor, cursor, particles
- Two-layer renderer (base + visible), DPR handling, custom per-tool cursor,
  capped particle/ripple feedback.
- **Acceptance:** 60 FPS maintained under continuous fast drags; cursor switches
  per tool; Clear/Save work (Save PNG is crisp at DPR).

### M5 — UI polish & controls
- Draggable/dockable video window, tool HUD with "next" countdown, top control
  bar (Clear/Save/Toggle sync/Toggle audio), error toasts.
- **Acceptance:** all controls functional; UI re-renders only on discrete
  events (verified by a dev flag counting DOM mutations — zero per-frame writes).

### M6 — Verification pass (MVP sign-off)
- Execute all four brief verification criteria via §11 procedures.
- **Acceptance:** all four criteria pass on desktop Chrome + Firefox and one
  tablet; no blocker bugs.

### M7 — Release prep (deferred until GitHub publication authorized)
- CI workflow, README polish, LICENSE.
- **Acceptance:** `npm run ci` (lint + typecheck + test + build) green.

---

## 11. Mapping: Spec's 4 MVP Verification Criteria → Test Procedures

| # | Spec criterion | Concrete test procedure | Owner / milestone |
|---|----------------|-------------------------|-------------------|
| 1 | *App presents a playable YouTube video in a floating PiP window + full-bleed canvas* | Load app in Chrome. Assert: (a) canvas fills ≥80% viewport; (b) video window visible bottom-right, draggable within bounds; (c) pressing Play starts `OH94B9B8zDk` with audio; (d) window minimizes/restores. | M2 + M5 |
| 2 | *Play auto-syncs the active tool configuration* | With DevTools console open, start video; assert `AppState.activeTool.name` transitions `2-inch Brush → 2-inch Brush → Fan Brush → Palette Knife` at ~120/240/420 s, and the HUD text matches within ≤250 ms of the boundary. Verify pause freezes the tool; seek to 300 s sets the Fan Brush immediately. | M2 |
| 3 | *Dragging at 01:30 paints broad blue sky strokes; at 04:30 paints pine fan or knife snow* | Seek to 90 s (sky_wash, `#2C5282`, multiply) and drag: assert broad soft blue wash with feathered edges (visual) + `multiply` tint over the white base. Seek to 270 s (pine) and drag: assert needle-cluster stamps. Seek to 430 s (knife snow): assert crisp breaking-edge snow with visible noise/break texture. Capture screenshots for each as regression artifacts. | M3 |
| 4 | *Canvas feels liquid, responsive, smooth, relaxing* | (a) Automated: run a scripted fast drag; assert frame time p95 < 16.6 ms over 10 s (Chrome Performance panel / `requestAnimationFrame` delta sampling). (b) Manual: rapid circular sweeps show no jaggedness (bezier smoothing) and no cursor lag. (c) Subjective: no UI flicker; strokes build gradually (wet-on-wet). | M4 + M6 |

### 11.1 Acceptance mapping summary

The acceptance criteria in §10 reference these procedures; M6 runs all four as
the official MVP gate. Screenshots from criterion 3 are stored under
`docs/qa/` (gitignored in MVP, retained locally) as visual regression evidence.


---

## 12. Testing Strategy, Risks, & Open Questions

### 12.1 Unit tests (Vitest)

| Module | What is tested | Key cases |
|--------|----------------|-----------|
| `schema.test.ts` | Zod validation | valid script passes; bad hex color, reversed `endTime`, overlapping segments, unknown `type`, negative time all rejected with correct `path` |
| `segmentStore.test.ts` | Binary search + store build | exact boundary (t = startTime → this segment; t = endTime → next), t before first, t after last, contiguity check |
| `syncEngine.test.ts` | Sync logic (fake TimeSource) | boundary crossing emits `tool:change` once; throttling (no eval more than 4×/s); pause freezes; seek re-evals; end holds last tool; sync-off freezes |
| `interpolation.test.ts` | Bezier sampling | smooth polyline passes through midpoints; sample spacing ≈ `spacing`; no NaNs on duplicate points; fast-sweep tracking |

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

### 12.5 Unknowns / open questions (top 3 + working list)

1. **Does YouTube allow IFrame embedding for `OH94B9B8zDk`?** Some *Joy of
   Painting* uploads disable embedding, which would block the sync engine's
   time source. Must be verified in M2; fallback is a locally-hosted excerpt or
   an alternate video id.
2. **Exact segment timestamps for s01e01.** The §4.4 times are illustrative;
   they need a real pass against the video to align tool changes with what Bob
   actually does (the episode's true tool changes may not match the brief's
   120/240/420 example).
3. **How much "wet" realism is enough for MVP?** The Canvas2D alpha/multiply
   model may read as flat compared to real wet-on-wet mixing; the MVP bar is
   "relaxing and believable," not photoreal, but the exact acceptance threshold
   is a judgment call to confirm early in M3.

Additional unknowns: precise needle-cluster density for fan brush; whether
`sage`/palette-knife fleck density should scale with velocity linearly or
quadratically; whether `OffscreenCanvas` is available on all target browsers
(fallback path required).

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
| 01:30 blue wash / 04:30 pine or knife snow | §11 row 3 (screenshots) | M3 |
| Liquid, smooth, relaxing feel | §11 row 4 (p95 < 16.6 ms) | M4 + M6 |

All four are executed together as the official MVP sign-off in M6.
