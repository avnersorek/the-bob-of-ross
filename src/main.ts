import "./style.css";
import { loadScript } from "./core/sync/scriptLoader";
import { SegmentStore } from "./core/sync/segmentStore";
import { YouTubePlayer } from "./core/sync/YouTubePlayer";
import { SyncEngine } from "./core/sync/SyncEngine";
import { EventBus } from "./core/state/eventBus";
import { AppState } from "./core/state/AppState";
import { BrushFactory } from "./brush/BrushFactory";
import { PaintEngine } from "./brush/BrushEngine";
import { PointerPipeline } from "./brush/pointer";
import { Renderer } from "./render/Renderer";
import { ControlBar } from "./ui/ControlBar";
import { ToolHud } from "./ui/ToolHud";
import { NowNextPanel } from "./ui/NowNextPanel";
import { VideoWindow } from "./ui/VideoWindow";
import { VideoControls } from "./ui/VideoControls";

function defaultTool() {
  return {
    name: "2½-inch Brush",
    color: "#F7F7F2",
    type: "liquid_white_base" as const,
    opacity: 0.1,
    size: 60,
    blendMode: "source-over" as const,
  };
}

async function init() {
  const bus = new EventBus();
  const state = new AppState();
  const app = document.getElementById("app")!;
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const renderer = new Renderer(canvas);

  try {
    const script = loadScript();
    const store = new SegmentStore(script);
    const brushes = new BrushFactory();

    const videoWindow = new VideoWindow(app, bus);
    videoWindow.setContainerId("video-player");
    videoWindow.setTitle(script.title);
    videoWindow.show();

    const player = new YouTubePlayer("video-player", script.videoId, bus);
    player.load();

    const fallbackTool = store.segments.find((s) => s.tool.opacity > 0)?.tool ?? defaultTool();
    const engine = new PaintEngine(
      brushes,
      fallbackTool,
      renderer.getBaseContext(),
      (x, y, color, count) => renderer.spawnParticles(x, y, color, count)
    );
    state.brushEngine = engine;
    new PointerPipeline(canvas, engine);

    const syncEngine = new SyncEngine(player, store, bus, state, brushes);
    syncEngine.start();

    const videoControls = new VideoControls(player, syncEngine, bus);

    new ControlBar(app, bus, {
      onClear: () => bus.emit("brush:clear", {}),
      onSave: () => {
        const url = renderer.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = "the-bob-of-ross.png";
        a.click();
      },
      onToggleSync: () => {
        state.syncEnabled = !state.syncEnabled;
        bus.emit("sync:toggle", { enabled: state.syncEnabled });
      },
      onToggleAudio: () => {
        state.audioMuted = !state.audioMuted;
        if (state.audioMuted) player.mute();
        else player.unMute();
      },
    });
    new ToolHud(app, bus, state, fallbackTool);
    new NowNextPanel(store, state, bus);

    bus.on("nav:seek", ({ time }) => {
      const wasPlaying = player.getState() === "playing";
      videoControls.seekTo(time);
      const now = player.getState();
      if (wasPlaying && now === "paused") player.play();
      if (!wasPlaying && now === "playing") player.pause();
    });

    bus.on("brush:clear", () => {
      engine.clear();
      renderer.clear();
      state.baseHasPaint = false;
    });

    bus.on("tool:change", ({ next }) => {
      const name =
        next && typeof next === "object" && "name" in next ? (next as { name: string }).name : null;
      canvas.setAttribute("aria-label", name ? `Painting canvas — ${name}` : "Painting canvas");
    });

    let toolRef: unknown = null;
    function loop() {
      if (state.activeTool !== toolRef) {
        toolRef = state.activeTool;
        engine.setTool(state.activeTool);
      }
      if (engine.painted) {
        state.baseHasPaint = true;
      }
      engine.flush();
      renderer.render(state, engine);
      requestAnimationFrame(loop);
    }
    loop();

    const bob = {
      state,
      engine,
      renderer,
      store,
      player,
      pinTool(index: number) {
        const seg = store.segments[index];
        if (!seg) return;
        state.syncEnabled = false;
        state.activeTool = seg.tool;
        state.activeSegment = seg;
        state.activeSegmentIndex = index;
        bus.emit("sync:toggle", { enabled: false });
        bus.emit("tool:change", { prev: null, next: seg.tool });
      },
      unpin() {
        state.syncEnabled = true;
        bus.emit("sync:toggle", { enabled: true });
        syncEngine.seek(0);
      },
      seek(t: number) {
        videoControls.seekTo(t);
      },
      setTime(t: number) {
        player.setForceTime(t);
        syncEngine.seek(t);
        syncEngine.evaluateNow();
      },
      getState() {
        return {
          time: state.currentTime,
          index: state.activeSegmentIndex,
          segment: state.activeSegment,
          nextSegment: state.nextSegment,
          timeToNext: state.timeToNext,
          activeTool: state.activeTool,
        };
      },
      clear() {
        bus.emit("brush:clear", {});
      },
      getTool() {
        return state.activeTool;
      },
    };
    (window as unknown as { __bob: unknown }).__bob = bob;
    (window as unknown as { __bobSeek: unknown }).__bobSeek = (t: number) => {
      bob.seek(t);
      return {
        time: player.getCurrentTime(),
        duration: player.getDuration(),
        index: state.activeSegmentIndex,
        tool: state.activeTool?.name ?? null,
        color: state.activeTool?.color ?? null,
      };
    };

    const query = new URLSearchParams(window.location.search);
    const pin = query.get("pin");
    if (pin !== null) {
      bob.pinTool(Number(pin));
    }
    const seekTo = query.get("t");
    if (seekTo !== null) {
      const seconds = Number(seekTo);
      const doSeek = () => {
        bob.seek(seconds);
      };
      bus.on("player:ready", doSeek);
      window.setTimeout(doSeek, 800);
    }
  } catch (e) {
    console.error(e);
    bus.emit("script:error", { message: "Failed to load script" });
  }
}

init();
