import type { Segment, ToolScript } from "../../data/script.schema";

export interface LookaheadSegment {
  segment: Segment;
  inMs: number;
}

export class SegmentStore {
  readonly segments: Segment[];
  readonly duration: number;

  constructor(script: ToolScript) {
    const sorted = [...script.timeline].sort((a, b) => a.startTime - b.startTime);
    this.segments = sorted;
    this.duration = sorted.length > 0 ? sorted[sorted.length - 1]!.endTime : 0;
  }

  segmentAt(time: number): Segment | null {
    const i = this.indexAt(time);
    if (i < 0 || i >= this.segments.length) return null;
    return this.segments[i]!;
  }

  nextSegment(time: number): LookaheadSegment | null {
    return this.nextSegments(time, 1)[0] ?? null;
  }

  nextSegments(time: number, count = 2): LookaheadSegment[] {
    const i = this.indexAt(time);
    if (i < 0) return [];
    const out: LookaheadSegment[] = [];
    for (let k = 1; k <= count; k++) {
      const seg = this.segments[i + k];
      if (!seg) break;
      out.push({ segment: seg, inMs: Math.max(0, (seg.startTime - time) * 1000) });
    }
    return out;
  }

  indexAt(time: number): number {
    if (this.segments.length === 0) return -1;
    if (time <= this.segments[0]!.startTime) return 0;
    if (time >= this.duration) return this.segments.length - 1;

    let left = 0;
    let right = this.segments.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const seg = this.segments[mid]!;
      if (time >= seg.endTime) {
        left = mid + 1;
      } else if (time < seg.startTime) {
        right = mid - 1;
      } else {
        return mid;
      }
    }
    // If not in exact range, return the segment where time is in [start, end)
    if (left < this.segments.length) {
      const seg = this.segments[left]!;
      if (time >= seg.startTime && time < seg.endTime) {
        return left;
      }
    }
    // Fallback to right
    return Math.max(0, right);
  }
}
