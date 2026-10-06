import type { EventBus } from "../state/eventBus";

export type PlayerState = "unstarted" | "playing" | "paused" | "ended" | "buffering";

export interface TimeSource {
  getCurrentTime(): number;
  getDuration(): number;
  getState(): PlayerState;
  isAdvancing(): boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export class YouTubePlayer implements TimeSource {
  private player: any = null;
  private state: PlayerState = "unstarted";
  private lastTime = 0;
  private lastTimeAt = 0;

  constructor(
    private containerId: string,
    private videoId: string,
    private bus: EventBus
  ) {}

  load(): void {
    if (window.YT && window.YT.Player) {
      this.createPlayer();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
    window.onYouTubeIframeAPIReady = () => this.createPlayer();
  }

  private createPlayer(): void {
    this.player = new window.YT.Player(this.containerId, {
      videoId: this.videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          this.bus.emit("player:ready", {});
        },
        onStateChange: (event: any) => {
          const states: Record<number, PlayerState> = {
            0: "ended",
            1: "playing",
            2: "paused",
            3: "buffering",
            5: "unstarted",
          };
          this.state = states[event.data] || "unstarted";
          this.bus.emit("player:state", { state: this.state });
          if (this.state === "playing") this.bus.emit("player:playing", {});
          if (this.state === "paused") this.bus.emit("player:paused", {});
          if (this.state === "ended") this.bus.emit("player:ended", {});
        },
        onError: (_: any) => {
          this.bus.emit("script:error", { message: "YouTube player error" });
        },
      },
    });
  }

  getCurrentTime(): number {
    try {
      return this.player?.getCurrentTime() || 0;
    } catch {
      return 0;
    }
  }

  getDuration(): number {
    try {
      return this.player?.getDuration() || 0;
    } catch {
      return 0;
    }
  }

  getState(): PlayerState {
    return this.state;
  }

  isAdvancing(): boolean {
    const now = performance.now();
    const t = this.getCurrentTime();
    if (this.state === "playing" && t > this.lastTime + 0.01) {
      this.lastTime = t;
      this.lastTimeAt = now;
      return true;
    }
    if (this.state === "playing" && now - this.lastTimeAt < 100) {
      return true;
    }
    return false;
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seekTo(seconds: number): void {
    this.player?.seekTo(seconds, true);
    this.bus.emit("player:seek", { time: seconds });
  }

  mute(): void {
    this.player?.mute();
    this.bus.emit("audio:toggle", { muted: true });
  }

  unMute(): void {
    this.player?.unMute();
    this.bus.emit("audio:toggle", { muted: false });
  }
}
