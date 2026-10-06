import type { ToolConfig } from "../../data/script.schema";

type EventMap = {
  "tool:change": { prev: unknown; next: unknown };
  "tool:end": { index: number; finished: ToolConfig | null; next: ToolConfig | null };
  "toolend:toggle": { enabled: boolean };
  "segment:change": { index: number; segment: unknown; next: unknown; timeToNext: number };
  "player:state": { state: string };
  "player:seek": { time: number };
  "nav:seek": { time: number };
  "player:ready": {};
  "player:playing": {};
  "player:paused": {};
  "player:ended": {};
  "sync:toggle": { enabled: boolean };
  "audio:toggle": { muted: boolean };
  "script:error": { message: string };
  "brush:clear": {};
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

export class EventBus {
  private listeners = new Map<keyof EventMap, Set<Listener<any>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        listener(payload);
      });
    }
  }
}

export type { EventMap };
