# The Bob of Ross — paint along with Bob Ross in real time

A web app where the canvas tool follows the video: as Bob Ross paints, the active brush, color, size, opacity and blend mode swap automatically to match what he is using at that exact second.

## What it does

- Embeds an episode of *The Joy of Painting* in a small floating, draggable YouTube player over a full-bleed HTML5 canvas.
- Reads a **time-coded JSON tool script** (`src/data/s01e01.json`) and syncs the active tool to the video's `currentTime`.
- You just click and drag: a procedural brush engine (Canvas 2D) renders strokes that mimic the technique for the active moment — broad soft washes, needle-cluster foliage, crisp palette-knife breaking edges — with wet-on-wet layering.
- HUD shows the active tool, and a now/next lookahead panel shows what is coming (`Next: Palette Knife · #CBD5E0 · in 1:08`); controls cover Clear Canvas, Save PNG, a sync toggle (turn it off to free-paint with the current tool) and mute.
- Shipped with one authored script: Season 1 Episode 1, *"A Walk in the Woods"* (19 segments, 0–1665 s).

## Requirements

- **Node.js >= 20** (see `engines` in `package.json`)
- npm (ships with Node)
- A Chromium-based browser if you use the screenshot verification script (see [Development & verification](#development--verification))

## Quickstart

```bash
npm install
npm run dev      # dev server → http://localhost:5173
npm run build    # production build → dist/
npm test         # unit tests (vitest)
```

Then open the URL, press Play on the video window, and drag on the canvas.

More commands:

```bash
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --write
npm run ci         # lint + typecheck + test + build in one go
```

## How the script + video sync works

1. **The script is data.** `src/data/s01e01.json` is a list of contiguous, non-overlapping `timeline` segments. Each segment has `startTime` / `endTime` (seconds) and a `tool` object (`name`, `color`, `type`, `size`, `opacity`, `blendMode`, plus optional `breakTexture`, `spacing`, `flow`) and the `bobDialogue` line for that moment.
2. **It is validated on load.** `src/core/sync/scriptLoader.ts` parses the JSON with the Zod schema (`src/data/script.schema.ts`) before anything else runs; an invalid script fails loudly instead of silently desyncing.
3. **Segments are indexed.** `SegmentStore` (`src/core/sync/segmentStore.ts`) sorts the timeline and answers `indexAt(t)` with a binary search, plus lookahead ("what's next and in how many ms").
4. **The sync engine polls the player.** `SyncEngine` (`src/core/sync/SyncEngine.ts`) runs on its own `requestAnimationFrame` loop. It evaluates at most every 250 ms in steady state, but switches to every frame once the next boundary is within 400 ms, so the tool change lands frame-accurate. Because it resolves by *absolute* video time (never by counting frames), buffering, lag and seeking cannot accumulate drift.
5. **Changes flow through the app.** On a segment change the engine sets `AppState.activeTool` and emits `tool:change`; the brush engine picks up the new tool on the next frame, and the HUD updates its text. The render loop only draws pixels — it never updates UI elements.

The YouTube player is wrapped by `src/core/sync/YouTubePlayer.ts` (YouTube IFrame Player API); sync/audio are independent toggles, and there is no autoplay — you press Play.

## Adding or editing a script

1. **Edit `src/data/s01e01.json`** (or add a new file next to it):
   - `videoId` — the YouTube id to embed.
   - `title` — shown on the video window.
   - `timeline[]` — ordered segments; each `endTime` must be greater than its `startTime`, and segments must not overlap (they may touch: `timeline[i].startTime === timeline[i-1].endTime`).
2. **The contract is the Zod schema** in `src/data/script.schema.ts`. It is the single source of truth: the TypeScript types (`ToolConfig`, `Segment`, `ToolScript`) are inferred from it, so the schema is where you add a field or a new tool type. `ToolType` is restricted to `liquid_white_base`, `sky_wash`, `pine_tree_foliage`, `mountain_snow`; `blendMode` to `source-over`, `multiply`, `screen`, `lighter`.
3. **Validate:** `npm test` runs `tests/unit/schema.test.ts` against `src/data/s01e01.json` plus the fixtures in `tests/fixtures/` (`valid.script.json`, `invalid.script.json`). Add your mutation case there if you change the schema.
4. **Wire it up:** point `loadScript()` at your new JSON (it is a static import, so Vite bundles it) and set the video id in the script.

Segment boundaries and tool choices for the shipped episode are documented in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) (§4.4).

## Project layout

```
├── index.html              # app shell: canvas, video window, control bar, HUD
├── src/
│   ├── main.ts             # bootstrap: wire modules, dev hooks, rAF loop
│   ├── style.css           # dark "room" theme + layout
│   ├── data/
│   │   ├── s01e01.json     # the time-coded tool script (edit this)
│   │   └── script.schema.ts# Zod schema — the script contract + TS types
│   ├── core/
│   │   ├── sync/           # SyncEngine, YouTubePlayer, SegmentStore, loader
│   │   └── state/          # AppState + tiny typed event bus
│   ├── brush/              # brush engine: Stroke, interpolation, 4 brushes, sprites
│   ├── render/             # renderer loop, compositor, cursor, particles
│   ├── ui/                 # ControlBar, ToolHud, NowNextPanel, VideoWindow, drag
│   └── util/               # color / math / time helpers
├── tests/unit/             # vitest: schema, segment store, sync, brushes, ...
├── scripts/screenshot.mjs  # headless capture + stroke simulation (see below)
└── docs/                   # spec, implementation plan, transcript, qa/ (gitignored)
```

## Development & verification

Typical loop: `npm run dev` + `npm run typecheck` + `npm run lint` + `npm test` + `npm run build`.

**`scripts/screenshot.mjs`** is a headless verification tool. It drives a Chromium-based browser through `puppeteer-core` (no browser download), loads the app, optionally simulates clicks and drag strokes, and prints a JSON report — DOM state, canvas size, HUD text, console/page errors, failed requests, and canvas pixel stats (checksum before vs. after, so you can prove strokes actually painted) — plus a PNG screenshot.

```bash
# 1. start the dev server in one terminal
npm run dev

# 2. capture + simulate a stroke in another
node scripts/screenshot.mjs --drag 400,500,1100,520 --out docs/qa/check.png
# or: npm run screenshot -- --drag 400,500,1100,520
```

Options (see the header comment in `scripts/screenshot.mjs` for the full list): `--url`, `--out`, `--width`, `--height`, `--wait`, `--click <selector>`, `--drag x1,y1,x2,y2`, `--eval <js>`, `--exec <path>`.

**Browser:** it needs a local Chromium-based browser executable. It uses `$BRAVE_PATH` if set, otherwise `/usr/bin/brave-browser`; override per-run with `--exec`, e.g.:

```bash
BRAVE_PATH=/usr/bin/chromium node scripts/screenshot.mjs
node scripts/screenshot.mjs --exec /path/to/chrome
```

Screenshots and other QA artifacts are written to `docs/qa/`, which is gitignored.

**Dev hooks:** the app exposes `window.__bob` (`pinTool`, `unpin`, `seek`, `setTime`, `getState`, `clear`) for scripted inspection, plus `?pin=<segmentIndex>` and `?t=<seconds>` URL params to pin a tool or seek on load — handy for repeatable captures.

## Docs

- [`docs/INITIAL_SPEC.md`](docs/INITIAL_SPEC.md) — original project brief
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — design document (architecture, brush math, milestones)
- [`docs/bob-transcript-s01e01.txt`](docs/bob-transcript-s01e01.txt) — episode transcript used to derive the timestamps
- [`src/data/s01e01.json`](src/data/s01e01.json) — the authored tool script

## License

[MIT](LICENSE) — Copyright (c) 2026 Avner Sorek

## Disclaimer

"The Joy of Painting" and Bob Ross are trademarks of their respective owners. This project is unaffiliated with them and distributes no video content — it only embeds a YouTube player.
