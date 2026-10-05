import "./style.css";
import { loadScript } from "./core/sync/scriptLoader";
import { SegmentStore } from "./core/sync/segmentStore";
import { YouTubePlayer } from "./core/sync/YouTubePlayer";
import { SyncEngine } from "./core/sync/SyncEngine";
import { EventBus } from "./core/state/eventBus";
import { AppState } from "./core/state/AppState";
import { BrushFactory } from "./brush/BrushFactory";
import { Renderer } from "./render/Renderer";
import { ControlBar } from "./ui/ControlBar";
import { ToolHud } from "./ui/ToolHud";
import { VideoWindow } from "./ui/VideoWindow";

async function init() {
  const bus = new EventBus();
  const state = new AppState();
  const app = document.getElementById("app")!;
  
  try {
    const script = loadScript();
    const store = new SegmentStore(script);
    const brushes = new BrushFactory();
    
    const videoWindow = new VideoWindow(app, bus);
    videoWindow.setContainerId("video-player");
    videoWindow.show();
    
    const player = new YouTubePlayer("video-player", script.videoId, bus);
    player.load();
    
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const renderer = new Renderer(canvas);
    state.brushEngine = {
      beginStroke: () => {},
      move: () => {},
      endStroke: () => {},
      clear: () => renderer.clear(),
      setTool: () => {},
      prepare: () => {},
    } as any;
    
    const syncEngine = new SyncEngine(player, store, bus, state, brushes);
    syncEngine.start();
    
    new ControlBar(app, bus);
    new ToolHud(app, bus);
    
    function loop() {
      renderer.render();
      requestAnimationFrame(loop);
    }
    loop();
  } catch (e) {
    console.error(e);
    bus.emit("script:error", { message: "Failed to load script" });
  }
}

init();
