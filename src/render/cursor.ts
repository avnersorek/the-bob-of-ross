import type { ToolConfig } from "../data/script.schema";

export class CursorRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tool: ToolConfig,
    active: boolean
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.65)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    const s = tool.size;
    const name = (tool.name || "").toLowerCase();

    let shape: "rect" | "fan" | "blade" | "foliage";
    if (tool.type === "mountain_snow") {
      shape = "blade";
    } else if (name.includes("fan")) {
      shape = "fan";
    } else if (tool.type === "pine_tree_foliage") {
      shape = "foliage";
    } else {
      shape = "rect";
    }

    switch (shape) {
      case "rect": {
        const w = Math.max(4, s);
        const h = Math.max(3, s * 0.5);
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case "fan": {
        const r = Math.max(6, s * 0.8);
        const start = -1.25;
        const end = 1.25;
        ctx.beginPath();
        ctx.arc(x, y, r, start, end);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.55, start, end);
        ctx.stroke();
        for (let i = 0; i <= 6; i++) {
          const a = start + ((end - start) * i) / 6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          ctx.stroke();
        }
        break;
      }
      case "blade": {
        const len = Math.max(12, s * 2.2);
        const w = Math.max(6, s * 1.1);
        const angle = active ? -0.75 : -0.4;
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(len / 2, 0);
        ctx.lineTo(len * 0.15, w / 2);
        ctx.lineTo(-len / 2, 0);
        ctx.lineTo(len * 0.15, -w / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(-len / 2 - 5, 0);
        ctx.stroke();
        break;
      }
      case "foliage": {
        const r = Math.max(4, s * 0.6);
        ctx.beginPath();
        ctx.arc(x, y, r, -0.7, 0.7);
        ctx.stroke();
        for (let i = -3; i <= 3; i++) {
          const a = i * 0.22;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }
}
