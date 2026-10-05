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
});