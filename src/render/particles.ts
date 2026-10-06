export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const MAX_PARTICLES = 160;
const LIFE_MS = 520;

export class ParticleSystem {
  private list: Particle[] = [];
  private readonly max: number;

  constructor(max = MAX_PARTICLES) {
    this.max = max;
  }

  get count(): number {
    return this.list.length;
  }

  spawn(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) {
        this.list.shift();
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.4;
      this.list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: LIFE_MS * (0.6 + Math.random() * 0.8),
        size: 1.2 + Math.random() * 3,
        color,
      });
    }
  }

  update(dtMs: number): void {
    if (!dtMs || this.list.length === 0) return;
    const f = dtMs / 16.6667;
    for (const p of this.list) {
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.life += dtMs;
    }
    this.list = this.list.filter((p) => p.life < p.maxLife);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.list.length === 0) return;
    ctx.save();
    for (const p of this.list) {
      const t = Math.min(1, p.life / p.maxLife);
      ctx.globalAlpha = Math.max(0, 0.22 * (1 - t));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.5 + t * 1.1)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear(): void {
    this.list.length = 0;
  }
}
