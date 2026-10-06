import { hexToRgba } from "../util/color";

export type Falloff = "gaussian" | "smooth";

const MAX_CACHE = 32;
const cache = new Map<string, HTMLCanvasElement>();
const STOP_COUNT = 16;

function makeSprite(color: string, radius: number, falloff: Falloff): HTMLCanvasElement {
  const diameter = Math.max(2, Math.ceil(radius * 2));
  const canvas = document.createElement("canvas");
  canvas.width = diameter;
  canvas.height = diameter;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const c = radius;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (let i = 0; i <= STOP_COUNT; i++) {
    const t = i / STOP_COUNT;
    const r = t * t;
    const alpha = falloff === "gaussian" ? Math.exp(-4.5 * r) : Math.pow(1 - r, 2);
    gradient.addColorStop(i / STOP_COUNT, hexToRgba(color, alpha));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, diameter, diameter);
  return canvas;
}

export function getSoftSprite(color: string, radius: number, falloff: Falloff): HTMLCanvasElement {
  const key = `${falloff}|${color}|${radius.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = makeSprite(color, radius, falloff);
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, sprite);
  return sprite;
}
