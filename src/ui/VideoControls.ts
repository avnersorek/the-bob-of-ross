import type { YouTubePlayer } from "../core/sync/YouTubePlayer";
import type { SyncEngine } from "../core/sync/SyncEngine";
import type { EventBus } from "../core/state/eventBus";
import { formatTime } from "../util/time";

const SEEK_STEP = 10;
const KEY_SEEK_STEP = 5;
const REEVAL_DELAYS_MS = [0, 60, 200, 500];

export class VideoControls {
  private seekBackBtn: HTMLButtonElement;
  private seekFwdBtn: HTMLButtonElement;
  private playPauseBtn: HTMLButtonElement;
  private seekBar: HTMLInputElement;
  private timeReadout: HTMLDivElement;
  private isDragging = false;
  private reevalTimers: number[] = [];
  private keyboardHandler = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(
    private player: YouTubePlayer,
    private syncEngine: SyncEngine,
    private bus: EventBus
  ) {
    this.seekBackBtn = document.getElementById("seek-back") as HTMLButtonElement;
    this.seekFwdBtn = document.getElementById("seek-fwd") as HTMLButtonElement;
    this.playPauseBtn = document.getElementById("play-pause") as HTMLButtonElement;
    this.seekBar = document.getElementById("seek-bar") as HTMLInputElement;
    this.timeReadout = document.getElementById("time-readout") as HTMLDivElement;

    this.seekBackBtn.addEventListener("click", () => this.seekBy(-SEEK_STEP));
    this.seekFwdBtn.addEventListener("click", () => this.seekBy(SEEK_STEP));
    this.playPauseBtn.addEventListener("click", () => this.togglePlayPause());
    this.seekBar.addEventListener("input", () => this.onSeekBarInput());

    this.bus.on("player:state", () => this.update());
    this.bus.on("player:seek", () => this.update());
    this.bus.on("player:ready", () => this.update());

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.keyboardHandler);
    }
    this.update();
    if (typeof window !== "undefined") {
      window.setInterval(() => this.update(), 250);
    }
  }

  dispose(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.keyboardHandler);
      this.reevalTimers.forEach((id) => window.clearTimeout(id));
    }
    this.reevalTimers = [];
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target = e.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) {
        return;
      }
    }
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      this.togglePlayPause();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.seekBy(-KEY_SEEK_STEP);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      this.seekBy(KEY_SEEK_STEP);
    }
  }

  private togglePlayPause(): void {
    if (this.player.getState() === "playing") {
      this.player.pause();
      this.bus.emit("player:state", { state: "paused" });
    } else {
      this.player.play();
      this.bus.emit("player:state", { state: "playing" });
    }
    this.update();
  }

  private seekBy(delta: number): void {
    const duration = this.player.getDuration();
    let next = this.player.getCurrentTime() + delta;
    if (next < 0) next = 0;
    if (duration > 0 && next > duration) next = duration;
    this.seekTo(next);
  }

  seekTo(seconds: number): void {
    const duration = this.player.getDuration();
    let target = seconds;
    if (!isFinite(target)) return;
    if (target < 0) target = 0;
    if (duration > 0 && target > duration) target = duration;

    this.player.clearForceTime();
    this.syncEngine.seek(target);
    this.syncEngine.evaluateAt(target);
    this.player.seekTo(target);
    this.resync(target);
    this.update();
  }

  resync(target?: number): void {
    this.reevalTimers.forEach((id) => window.clearTimeout(id));
    this.reevalTimers = REEVAL_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        const t = target ?? this.player.getCurrentTime();
        this.syncEngine.seek(t);
        this.syncEngine.evaluateNow();
        this.update();
      }, delay)
    );
  }

  private onSeekBarInput(): void {
    const duration = this.player.getDuration();
    const pct = parseFloat(this.seekBar.value);
    if (!duration || !isFinite(pct)) return;
    const seconds = Math.max(0, Math.min(duration, (pct / 100) * duration));
    this.isDragging = true;
    this.seekTo(seconds);
    this.timeReadout.textContent = `${formatTime(seconds)} / ${formatTime(duration)}`;
    this.isDragging = false;
  }

  private update(): void {
    const current = this.player.getCurrentTime();
    const duration = this.player.getDuration();
    const playing = this.player.getState() === "playing";

    this.playPauseBtn.textContent = playing ? "Pause" : "Play";
    this.playPauseBtn.setAttribute("aria-label", playing ? "Pause video" : "Play video");
    this.timeReadout.textContent = `${formatTime(current)} / ${formatTime(duration)}`;

    if (!this.isDragging && duration > 0) {
      const pct = Math.max(0, Math.min(100, (current / duration) * 100));
      if (document.activeElement !== this.seekBar) {
        this.seekBar.value = String(pct);
      }
    }
  }
}
