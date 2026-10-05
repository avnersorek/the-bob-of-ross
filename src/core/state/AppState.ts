import type { ToolConfig, Segment } from "../../data/script.schema";
import type { BrushEngine } from "../../brush/Brush";

export type PlayerState = "unstarted" | "playing" | "paused" | "ended" | "buffering";

export class AppState {
  activeSegment: Segment | null = null;
  activeSegmentIndex = -1;
  activeTool: ToolConfig | null = null;
  syncEnabled = true;
  audioMuted = false;
  playerState: PlayerState = "unstarted";
  currentTime = 0;
  timeToNext = 0;
  nextSegment: Segment | null = null;
  baseHasPaint = false;
  brushEngine: BrushEngine | null = null;
}