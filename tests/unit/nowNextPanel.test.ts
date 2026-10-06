// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NowNextPanel, upcomingEntries } from "../../src/ui/NowNextPanel";
import { SegmentStore } from "../../src/core/sync/segmentStore";
import { loadScript } from "../../src/core/sync/scriptLoader";
import { EventBus } from "../../src/core/state/eventBus";
import { AppState } from "../../src/core/state/AppState";

describe("NowNextPanel", () => {
  let store: SegmentStore;
  let bus: EventBus;
  let state: AppState;
  let panel: NowNextPanel | null = null;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    store = new SegmentStore(loadScript());
    bus = new EventBus();
    state = new AppState();
    state.currentTime = 0;
    panel = null;
  });

  afterEach(() => {
    panel?.dispose();
    panel = null;
    document.body.innerHTML = "";
  });

  it("maps every upcoming entry to its segment start time", () => {
    const entries = upcomingEntries(store, 0);

    expect(entries.map((e) => e.id)).toEqual(["next-0", "next-1"]);
    expect(entries.map((e) => e.targetTime)).toEqual([131, 218]);
    expect(entries[0]).toMatchObject({
      toolName: "2½-inch Brush",
      color: "#F7F7F2",
      countdown: 131,
    });

    const shifted = upcomingEntries(store, 131);
    expect(shifted.map((e) => e.targetTime)).toEqual([218, 252]);
    expect(upcomingEntries(store, store.duration + 10)).toEqual([]);
  });

  it("renders each Next entry as a button carrying its target time", () => {
    panel = new NowNextPanel(store, state, bus);

    const first = document.getElementById("next-0") as HTMLButtonElement;
    const second = document.getElementById("next-1") as HTMLButtonElement;

    expect(first.tagName).toBe("BUTTON");
    expect(first.getAttribute("type")).toBe("button");
    expect(first.getAttribute("data-target-time")).toBe("131");
    expect(first.getAttribute("aria-label")).toBe("Jump to 2½-inch Brush at 2:11");
    expect(first.textContent).toContain("2½-inch Brush");
    expect(first.textContent).toContain("#F7F7F2");
    expect(first.textContent).toContain("in 2:11");

    expect(second.getAttribute("data-target-time")).toBe("218");
    expect(second.getAttribute("aria-label")).toBe("Jump to 2-inch Brush at 3:38");
  });

  it("emits a nav:seek request with the entry's target time on click", () => {
    panel = new NowNextPanel(store, state, bus);
    const seeks: number[] = [];
    bus.on("nav:seek", ({ time }) => seeks.push(time));

    (document.getElementById("next-0") as HTMLButtonElement).click();

    expect(seeks).toEqual([131]);

    (document.getElementById("next-1") as HTMLButtonElement).click();

    expect(seeks).toEqual([131, 218]);
  });

  it("does not emit a seek when the Current line is clicked", () => {
    panel = new NowNextPanel(store, state, bus);
    const seeks: number[] = [];
    bus.on("nav:seek", ({ time }) => seeks.push(time));

    document
      .querySelector(".now-next-line:not(.now-next-jump)")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(seeks).toEqual([]);
  });

  it("retargets the entries after a seek refreshes the panel", () => {
    panel = new NowNextPanel(store, state, bus);
    const seeks: number[] = [];
    bus.on("nav:seek", ({ time }) => seeks.push(time));

    state.currentTime = 131;
    bus.emit("player:seek", { time: 131 });

    const first = document.getElementById("next-0") as HTMLButtonElement;
    expect(first.getAttribute("data-target-time")).toBe("218");
    expect(document.body.textContent).toContain("Current:");
    expect(document.getElementById("now-next")!.textContent).toContain("2-inch Brush");

    first.click();
    expect(seeks).toEqual([218]);
  });

  it("keeps keyboard focus on the entry across a countdown refresh", () => {
    panel = new NowNextPanel(store, state, bus);
    const first = document.getElementById("next-0") as HTMLButtonElement;
    first.focus();
    expect(document.activeElement).toBe(first);

    bus.emit("player:state", { state: "playing" });

    const after = document.getElementById("next-0") as HTMLButtonElement;
    expect(document.activeElement).toBe(after);
  });
});
