export interface BoundaryPauseInput {
  /** Segment index before this evaluation (-1 when nothing was active yet). */
  prevIndex: number;
  /** Segment index after this evaluation. */
  index: number;
  prevTime: number;
  time: number;
  /** True when the time change was produced by a seek (manual or programmatic). */
  seekDriven: boolean;
  playing: boolean;
  enabled: boolean;
  /** Boundary (target index) that already triggered an auto-pause this session. */
  lastFiredIndex: number | null;
}

/**
 * Decides whether an evaluation should auto-pause the player because playback
 * naturally walked across the end of the active tool segment.
 *
 * Fires only for a forward, adjacent boundary crossing while playing, never for
 * seek-driven index changes, and never twice for the same boundary.
 */
export function shouldAutoPauseAtBoundary(input: BoundaryPauseInput): boolean {
  if (!input.enabled || !input.playing || input.seekDriven) return false;
  if (input.prevIndex < 0) return false;
  if (input.index !== input.prevIndex + 1) return false;
  if (input.time <= input.prevTime) return false;
  if (input.lastFiredIndex === input.index) return false;
  return true;
}
