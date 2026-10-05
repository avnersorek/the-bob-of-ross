# The Bob of Ross — Painting with Bob

An interactive, web-based painting experience. Follow along with Bob Ross's
*The Joy of Painting* in real time — the canvas tool (brush, color, size,
wet-on-wet behavior) auto-syncs to what Bob is using at that exact second,
driven by a time-coded JSON script.

**Status:** Phase 1 (MVP) — implementation plan in progress.

## Docs

- [`docs/INITIAL_SPEC.md`](docs/INITIAL_SPEC.md) — original project brief
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — detailed plan (generated)
- [`docs/bob-transcript-s01e01.txt`](docs/bob-transcript-s01e01.txt) — episode transcript (source for timestamps)
- [`src/data/s01e01.json`](src/data/s01e01.json) — authored tool script

## Episode

- **Video:** "A Walk in the Woods" — https://www.youtube.com/watch?v=oh5p5f5_-7A
- **Script:** 20 time-coded segments derived from the episode transcript
  (canvas prep → sky → trees → trunks → foliage → path → puddles → water
  lines → final tree → signature)

## Concept

- Large HTML5 canvas (80–85% viewport) + small floating YouTube player.
- Time-synced tool engine: reads a timestamped script and swaps the active
  brush/color/blend behavior as the video plays.
- You just click-drag; the app handles the procedural painting physics.

## License

TBD (open source — to be published on GitHub).
