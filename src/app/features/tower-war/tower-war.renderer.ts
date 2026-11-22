import { Point } from '../../core/tower-war/tower-war.geometry';
import { TowerWarEngine } from '../../core/tower-war/tower-war.engine';
import { EngineEvent, Owner, Side, Tower, WORLD } from '../../core/tower-war/tower-war.models';

export interface ViewState {
  /** Tour d'origine du lien en cours de tracé. */
  dragFrom: number | null;
  pointer: Point | null;
  /** Trait « barrer » en cours (points du monde, horodatés en ms). */
  trail: { x: number; y: number; at: number }[];
}

interface Effect {
  x: number;
  y: number;
  at: number;
  owner: Side | null;
}

const COLORS: Record<Owner, string> = { player: '#3b8de0', ai: '#e0533b', neutral: '#8a8f99' };
const BACKGROUND = '#1b2230';
const EFFECT_MS = 450;
const TRAIL_MS = 260;
/** Écart latéral entre deux liens opposés pour qu'ils restent lisibles. */
const OPPOSITE_OFFSET = 1.6;

export function towerRadius(level: number): number {
  return 5 + level * 1.2;
}

/** Dessin sur canvas 2D. Aucun état de jeu ici : tout est relu depuis le moteur à chaque image. */
export class TowerWarRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private effects: Effect[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.scale = Math.min(this.canvas.width / WORLD.width, this.canvas.height / WORLD.height);
    this.offsetX = (this.canvas.width - WORLD.width * this.scale) / 2;
    this.offsetY = (this.canvas.height - WORLD.height * this.scale) / 2;
  }

  toWorld(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / (rect.width || 1);
    return {
      x: ((clientX - rect.left) * dpr - this.offsetX) / this.scale,
      y: ((clientY - rect.top) * dpr - this.offsetY) / this.scale,
    };
  }

  /** Tour touchée en `p` (rayon + marge de doigt), la plus proche en cas de recouvrement. */
  towerAt(engine: TowerWarEngine, p: Point, slack = 4): Tower | null {
    let best: Tower | null = null;
    let bestDistance = Infinity;
    for (const tower of engine.towers) {
      const d = Math.hypot(tower.x - p.x, tower.y - p.y);
      if (d <= towerRadius(engine.level(tower)) + slack && d < bestDistance) {
        best = tower;
        bestDistance = d;
      }
    }
    return best;
  }

  absorb(events: EngineEvent[], now: number): void {
    for (const e of events) {
      this.effects.push({ x: e.x, y: e.y, at: now, owner: e.kind === 'capture' ? e.owner : null });
    }
    this.effects = this.effects.filter((e) => now - e.at < EFFECT_MS);
  }

  draw(engine: TowerWarEngine, view: ViewState, now: number): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    ctx.fillStyle = '#222b3c';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    for (const link of engine.links) this.drawLink(engine, link);
    this.drawDrag(engine, view);
    for (const tower of engine.towers) this.drawTower(engine, tower, view.dragFrom === tower.id);
    this.drawEffects(now);
    this.drawTrail(view, now);
  }

  private linkEnds(engine: TowerWarEngine, link: TowerWarEngine['links'][number]) {
    const a = engine.towers[link.from];
    const b = engine.towers[link.to];
    const reversed = !!engine.linkBetween(link.to, link.from);
    const dx = (b.x - a.x) / link.length;
    const dy = (b.y - a.y) / link.length;
    const o = reversed ? OPPOSITE_OFFSET : 0;
    return { a, b, dx, dy, ox: -dy * o, oy: dx * o };
  }

  private drawLink(engine: TowerWarEngine, link: TowerWarEngine['links'][number]): void {
    const ctx = this.ctx;
    const { a, b, dx, dy, ox, oy } = this.linkEnds(engine, link);
    const color = COLORS[a.owner];
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x + ox, a.y + oy);
    ctx.lineTo(b.x + ox, b.y + oy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Flèche juste avant la tour cible.
    const tip = towerRadius(engine.level(b)) + 1.5;
    const tx = b.x + ox - dx * tip;
    const ty = b.y + oy - dy * tip;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - dx * 3 - dy * 1.6, ty - dy * 3 + dx * 1.6);
    ctx.lineTo(tx - dx * 3 + dy * 1.6, ty - dy * 3 - dx * 1.6);
    ctx.closePath();
    ctx.fill();

    for (const unit of link.units) {
      const x = a.x + (b.x - a.x) * unit.progress + ox;
      const y = a.y + (b.y - a.y) * unit.progress + oy;
      ctx.fillStyle = COLORS[unit.owner];
      ctx.strokeStyle = BACKGROUND;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawDrag(engine: TowerWarEngine, view: ViewState): void {
    if (view.dragFrom === null || !view.pointer) return;
    const ctx = this.ctx;
    const from = engine.towers[view.dragFrom];
    const target = this.towerAt(engine, view.pointer);
    const valid = !!target && target.id !== from.id && !engine.linkBetween(from.id, target.id);
    ctx.setLineDash([2, 1.6]);
    ctx.strokeStyle = valid ? '#ffffff' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(
      valid && target ? target.x : view.pointer.x,
      valid && target ? target.y : view.pointer.y,
    );
    ctx.stroke();
    ctx.setLineDash([]);
    if (valid && target) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, towerRadius(engine.level(target)) + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawTower(engine: TowerWarEngine, tower: Tower, selected: boolean): void {
    const ctx = this.ctx;
    const level = engine.level(tower);
    const r = towerRadius(level);
    ctx.fillStyle = COLORS[tower.owner];
    ctx.strokeStyle = selected ? '#ffffff' : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = selected ? 1.4 : 0.9;
    ctx.beginPath();
    if (tower.owner === 'ai') {
      // Carré (et non cercle) : le camp ne repose pas sur la seule couleur.
      ctx.rect(tower.x - r * 0.9, tower.y - r * 0.9, r * 1.8, r * 1.8);
    } else {
      ctx.arc(tower.x, tower.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 0.9;
    ctx.font = 'bold 6.2px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(tower.garrison), tower.x, tower.y - 0.8);
    ctx.fillText(String(tower.garrison), tower.x, tower.y - 0.8);

    for (let i = 0; i < level; i++) {
      ctx.beginPath();
      ctx.arc(tower.x + (i - (level - 1) / 2) * 2.4, tower.y + r - 2.2, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawEffects(now: number): void {
    const ctx = this.ctx;
    for (const e of this.effects) {
      const k = Math.min(1, (now - e.at) / EFFECT_MS);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.owner ? COLORS[e.owner] : '#ffffff';
      ctx.lineWidth = e.owner ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.owner ? 8 : 2) + k * (e.owner ? 10 : 4), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawTrail(view: ViewState, now: number): void {
    const ctx = this.ctx;
    const points = view.trail.filter((p) => now - p.at < TRAIL_MS);
    if (points.length < 2) return;
    ctx.strokeStyle = '#ffe28a';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}
