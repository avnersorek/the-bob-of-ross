import { describe, it, expect } from "vitest";
import { SegmentStore } from "../../src/core/sync/segmentStore";
import { loadScript } from "../../src/core/sync/scriptLoader";

describe("segmentStore", () => {
  it("finds segment by time", () => {
    const script = loadScript();
    const store = new SegmentStore(script);
    expect(store.indexAt(0)).toBe(0);
    expect(store.indexAt(200)).toBe(1);
    expect(store.indexAt(3000)).toBe(store.segments.length - 1);
  });

  it("has correct boundary semantics", () => {
    const script = loadScript();
    const store = new SegmentStore(script);
    if (store.segments.length > 1) {
      const seg = store.segments[1]!;
      expect(store.indexAt(seg.startTime)).toBe(1);
    }
  });

  it("returns the active segment for a time", () => {
    const store = new SegmentStore(loadScript());
    expect(store.segmentAt(250)?.tool.name).toBe("2-inch Brush");
    expect(store.segmentAt(250)?.tool.color).toBe("#E8DC7A");
    expect(store.segmentAt(900)?.tool.name).toBe("Palette Knife");
    expect(store.segmentAt(0)?.tool.name).toBe("Intro — no paint");
  });

  it("finds the immediate next segment with a countdown", () => {
    const store = new SegmentStore(loadScript());
    const next = store.nextSegment(250);
    expect(next).not.toBeNull();
    if (next) {
      expect(next.segment.startTime).toBe(252);
      expect(next.segment.tool.name).toBe("2-inch Brush");
      expect(next.segment.tool.color).toBe("#2C5282");
      expect(Math.ceil(next.inMs / 1000)).toBe(2);
    }
  });

  it("lists upcoming segments (lookahead) in order", () => {
    const store = new SegmentStore(loadScript());
    const nexts = store.nextSegments(131, 2);
    expect(nexts.map((n) => n.segment.startTime)).toEqual([218, 252]);
    expect(nexts.map((n) => n.segment.tool.name)).toEqual(["2-inch Brush", "2-inch Brush"]);
    expect(nexts.map((n) => n.segment.tool.color)).toEqual(["#E8DC7A", "#2C5282"]);
  });

  it("counts the countdown from the current time", () => {
    const store = new SegmentStore(loadScript());
    const nexts = store.nextSegments(218, 1);
    expect(nexts[0]?.inMs).toBe(34 * 1000);
    expect(Math.ceil(nexts[0]!.inMs / 1000)).toBe(34);
  });

  it("returns empty lookahead past the last segment", () => {
    const store = new SegmentStore(loadScript());
    expect(store.nextSegment(store.duration + 10)).toBeNull();
    expect(store.nextSegments(store.duration + 10, 2)).toEqual([]);
    const last = store.segments[store.segments.length - 1]!;
    expect(store.segmentAt(store.duration + 10)?.tool.name).toBe(last.tool.name);
  });

  it("respects the requested lookahead count", () => {
    const store = new SegmentStore(loadScript());
    expect(store.nextSegments(0, 2)).toHaveLength(2);
    expect(store.nextSegments(0, 4)).toHaveLength(4);
  });
});
