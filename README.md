# The Bob of Ross — Painting with Bob

An interactive, web-based painting experience. Follow along with Bob Ross's
*The Joy of Painting* in real time — the canvas tool (brush, color, size,
wet-on-wet behavior) auto-syncs to what Bob is using at that exact second,
driven by a time-coded JSON script.

**Status:** Phase 1 (MVP) — implementation in progress.

## Docs

- [`docs/INITIAL_SPEC.md`](docs/INITIAL_SPEC.md) — original project brief
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — detailed implementation plan
- [`docs/bob-transcript-s01e01.txt`](docs/bob-transcript-s01e01.txt) — episode transcript (source for timestamps)
- [`src/data/s01e01.json`](src/data/s01e01.json) — authored tool script

## Episode

- **Video:** "A Walk in the Woods" — https://www.youtube.com/watch?v=oh5p5f5_-7A
- **Script:** 19 time-coded segments derived from the episode transcript

## Quickstart

```bash
npm install
npm run dev
```

## Development

```bash
npm run build    # Build for production
npm run test     # Run tests
npm run lint     # Lint code
npm run typecheck # Type check
npm run preview  # Preview build
```

## License

MIT License — Copyright (c) 2026 Avner Sorek
