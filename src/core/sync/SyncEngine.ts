import type { EventBus } from "../state/eventBus";
import type { AppState } from "../state/AppState";
import type { SegmentStore } from "./segmentStore";
import type { TimeSource } from "./YouTubePlayer";
import type { BrushFactory } from "../../brush/BrushFactory";

const SYNC_INTERVAL_MS = 250;
const BOUNDARY_BAND_MS = 400;

export class SyncEngine {
  private lastEvalAt = 0;
  private lastTime = 0;
  private frameDt = 16.67;
  private pendingSeek = false;
  private forceSegmentEmit = false;
  private activeIdx = -1;
  private prevTool: any = null;
  private rafId = 0;

  constructor(
    private timeSource: TimeSource,
    private store: SegmentStore,
    private bus: EventBus,
    private state: AppState,
    private brushes: BrushFactory
  ) {}

  start(): void {
    this.tick();
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  seek(_t: number): void {
    this.pendingSeek = true;
    this.forceSegmentEmit = true;
    this.lastEvalAt = 0;
  }

  private tick = (): void => {
    if (typeof requestAnimationFrame !== "undefined") {
      this.rafId = requestAnimationFrame(this.tick);
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const shouldEval =
      this.pendingSeek ||
      now - this.lastEvalAt >= SYNC_INTERVAL_MS ||
      (this.state.timeToNext <= BOUNDARY_BAND_MS && this.timeSource.isAdvancing());

    if (!shouldEval) return;

    this.evaluateNow();
  };

  evaluateNow(): void {
    this.pendingSeek = false;
    this.lastEvalAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.evaluateAt(this.timeSource.getCurrentTime());
  }

  evaluateAt(t: number): void {
    const prevT = this.lastTime;
    this.lastTime = t;
    this.state.currentTime = t;

    if (
      this.timeSource.getState() === "playing" &&
      Math.abs(t - prevT) > Math.max(1.5, 4 * this.frameDt)
    ) {
      this.pendingSeek = true;
    }

    if (this.store.segments.length === 0) return;

    const segIdx = this.store.indexAt(t);
    const changed = segIdx !== this.activeIdx || this.forceSegmentEmit;
    this.forceSegmentEmit = false;

    this.activeIdx = segIdx;
    const activeSegment = this.store.segments[segIdx]!;
    this.state.activeSegment = activeSegment;
    this.state.activeSegmentIndex = segIdx;
    this.state.nextSegment = this.store.segments[segIdx + 1] ?? null;

    const nextSeg = this.state.nextSegment;
    if (nextSeg) {
      this.state.timeToNext = Math.max(0, nextSeg.startTime - t);
    } else {
      this.state.timeToNext = Math.max(0, this.store.duration - t);
    }

    if (this.state.syncEnabled && (changed || this.state.activeTool !== activeSegment.tool)) {
      this.state.activeTool = activeSegment.tool;
      this.bus.emit("tool:change", { prev: this.prevTool, next: activeSegment.tool });
      this.prevTool = activeSegment.tool;
    }

    if (changed) {
      this.bus.emit("segment:change", {
        index: segIdx,
        segment: activeSegment,
        next: nextSeg,
        timeToNext: this.state.timeToNext,
      });
    }

    if (this.state.syncEnabled && this.state.timeToNext <= BOUNDARY_BAND_MS && nextSeg) {
      try {
        this.brushes.forTool(nextSeg.tool).prepare(nextSeg.tool);
      } catch {
        // ignore
      }
    }
  }
}
