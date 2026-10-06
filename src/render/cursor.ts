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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    const s = tool.size;
    switch (tool.type) {
      case "liquid_white_base":
      case "sky_wash": {
        const w = Math.max(4, s);
        const h = Math.max(3, s * 0.5);
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case "pine_tree_foliage": {
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
      case "mountain_snow": {
        const angle = active ? 0.55 : 0.2;
        const w = Math.max(6, s * 0.8);
        const h = Math.max(3, s * 0.28);
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        break;
      }
    }
    ctx.restore();
  }
}
