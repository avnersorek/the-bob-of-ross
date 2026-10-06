import type { Point } from "./Brush";

export interface StrokeInputTarget {
  beginStroke(p: Point): void;
  move(p: Point): void;
  endStroke(): void;
  setHover(p: Point | null): void;
}

type PointerLike = Pick<PointerEvent, "clientX" | "clientY" | "timeStamp" | "pressure">;

export function cssXToDevice(canvas: HTMLCanvasElement, cssX: number): number {
  const client = canvas.clientWidth;
  if (client <= 0) return cssX;
  return (cssX * canvas.width) / client;
}

export function cssYToDevice(canvas: HTMLCanvasElement, cssY: number): number {
  const client = canvas.clientHeight;
  if (client <= 0) return cssY;
  return (cssY * canvas.height) / client;
}

export function toCanvasPoint(canvas: HTMLCanvasElement, e: PointerLike): Point {
  const rect = canvas.getBoundingClientRect();
  const style = window.getComputedStyle(canvas);
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const cssX = e.clientX - rect.left - borderLeft;
  const cssY = e.clientY - rect.top - borderTop;
  return {
    x: cssXToDevice(canvas, cssX),
    y: cssYToDevice(canvas, cssY),
    time: e.timeStamp,
    pressure: typeof e.pressure === "number" && e.pressure > 0 ? e.pressure : 0,
  };
}

export class PointerPipeline {
  private activePointerId: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private target: StrokeInputTarget
  ) {
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("lostpointercapture", this.onUp);
    canvas.addEventListener("pointerleave", this.onLeave);
    window.addEventListener("blur", this.onForceEnd);
    document.addEventListener("visibilitychange", this.onForceEnd);
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("lostpointercapture", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    window.removeEventListener("blur", this.onForceEnd);
    document.removeEventListener("visibilitychange", this.onForceEnd);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    if (e.button !== 0) return;
    if (e.target !== this.canvas) return;
    this.activePointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    this.target.beginStroke(toCanvasPoint(this.canvas, e));
  };

  private onMove = (e: PointerEvent): void => {
    this.target.setHover(toCanvasPoint(this.canvas, e));
    if (this.activePointerId === null || e.pointerId !== this.activePointerId) return;
    let events: PointerEvent[];
    if (typeof e.getCoalescedEvents === "function") {
      const coalesced = e.getCoalescedEvents();
      events = coalesced && coalesced.length > 0 ? coalesced : [e];
    } else {
      events = [e];
    }
    for (const ce of events) {
      this.target.move(toCanvasPoint(this.canvas, ce));
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    this.target.endStroke();
  };

  private onLeave = (): void => {
    if (this.activePointerId === null) {
      this.target.setHover(null);
    }
  };

  private onForceEnd = (): void => {
    if (this.activePointerId === null) return;
    this.activePointerId = null;
    this.target.endStroke();
  };
}
