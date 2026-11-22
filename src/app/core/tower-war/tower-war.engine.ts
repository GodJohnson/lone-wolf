import {
  EngineEvent,
  LINK_RATE,
  Link,
  MAX_GARRISON,
  MapDef,
  Side,
  Tower,
  UNIT_HP,
  UNIT_POWER,
  UNIT_SPEED,
  Unit,
  levelOf,
  otherSide,
} from './tower-war.models';
import { Point, segmentDistance } from './tower-war.geometry';

/** Marge pour les erreurs d'arrondi des cumuls flottants (0,05 × 20 ≠ 1). */
const EPSILON = 1e-9;

/** Tolérance (unités du monde) entre le geste « barrer » et la ligne d'un lien. */
export const CUT_TOLERANCE = 3;

/**
 * Règles de la Guerre des tours. Le moteur est mutable et synchrone : `step(dt)` fait avancer la
 * simulation, `addLink` / `removeLink` sont les seules actions (joueur et IA passent par les mêmes).
 *
 * Règles retenues (certaines précisent l'énoncé) :
 * - une tour possédée génère `niveau` unités par seconde ; une tour neutre ne génère rien ;
 * - un lien émet 1 unité par seconde prélevée sur la garnison (rien ne sort si elle est vide) ;
 * - une unité qui arrive sur une tour alliée l'incrémente ; sur une tour adverse ou neutre elle
 *   retire `force` unités à la garnison ; si la garnison est déjà vide, la tour est capturée et
 *   l'unité y reste (garnison 1) ;
 * - deux unités adverses qui se croisent sur deux liens opposés se battent : chacune retire sa force
 *   à la résistance de l'autre ;
 * - une tour capturée perd ses liens sortants ; les liens entrants subsistent (ils deviennent des
 *   attaques ou des renforts selon leur propriétaire) ;
 * - les unités survolent les tours rencontrées sur leur route ; seule la cible compte.
 */
export class TowerWarEngine {
  readonly towers: Tower[];
  links: Link[] = [];
  time = 0;
  winner: Side | null = null;
  private nextLinkId = 1;
  private events: EngineEvent[] = [];

  constructor(map: MapDef) {
    this.towers = map.towers.map((spec, id) => ({ id, ...spec, genAcc: 0 }));
  }

  level(tower: Tower): number {
    return levelOf(tower.garrison);
  }

  towersOf(side: Side): Tower[] {
    return this.towers.filter((t) => t.owner === side);
  }

  unitCount(side: Side): number {
    return this.links.reduce((n, l) => n + l.units.filter((u) => u.owner === side).length, 0);
  }

  linksFrom(towerId: number): Link[] {
    return this.links.filter((l) => l.from === towerId);
  }

  linkBetween(from: number, to: number): Link | undefined {
    return this.links.find((l) => l.from === from && l.to === to);
  }

  /** Trace un lien `from → to` pour `side`. Retourne `false` si l'action est refusée. */
  addLink(from: number, to: number, side: Side): boolean {
    if (this.winner || from === to) return false;
    const source = this.towers[from];
    const target = this.towers[to];
    if (!source || !target || source.owner !== side || this.linkBetween(from, to)) return false;
    this.links.push({
      id: this.nextLinkId++,
      from,
      to,
      length: Math.hypot(target.x - source.x, target.y - source.y),
      emitAcc: 1 / LINK_RATE,
      units: [],
      alive: true,
    });
    return true;
  }

  removeLink(link: Link): void {
    link.alive = false;
    this.links = this.links.filter((l) => l !== link);
  }

  /** Barre les liens de `side` que le trait [a, b] touche. Retourne le nombre de liens supprimés. */
  cutLinks(side: Side, a: Point, b: Point): number {
    const hit = this.links.filter((link) => {
      const source = this.towers[link.from];
      if (source.owner !== side) return false;
      return segmentDistance(a, b, source, this.towers[link.to]) <= CUT_TOLERANCE;
    });
    hit.forEach((l) => this.removeLink(l));
    return hit.length;
  }

  /** Événements (combats, captures) survenus depuis le dernier appel, pour l'affichage. */
  drainEvents(): EngineEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  step(dt: number): void {
    if (this.winner || dt <= 0) return;
    this.time += dt;
    this.generate(dt);
    this.emit(dt);
    this.advance(dt);
    this.fight();
    this.arrive();
  }

  private generate(dt: number): void {
    for (const tower of this.towers) {
      if (tower.owner === 'neutral') continue;
      tower.genAcc += this.level(tower) * dt;
      const whole = Math.floor(tower.genAcc + EPSILON);
      if (whole > 0) {
        tower.genAcc = Math.max(0, tower.genAcc - whole);
        tower.garrison = Math.min(MAX_GARRISON, tower.garrison + whole);
      }
    }
  }

  private emit(dt: number): void {
    const period = 1 / LINK_RATE;
    for (const link of this.links) {
      const source = this.towers[link.from];
      link.emitAcc += dt;
      while (link.emitAcc >= period - EPSILON) {
        if (source.garrison < 1) {
          link.emitAcc = period; // prêt : part dès que la garnison est regarnie
          break;
        }
        source.garrison -= 1;
        link.emitAcc -= period;
        link.units.push({
          owner: source.owner as Side,
          progress: 0,
          hp: UNIT_HP,
          power: UNIT_POWER,
        });
      }
    }
  }

  private advance(dt: number): void {
    for (const link of this.links) {
      const delta = (UNIT_SPEED * dt) / link.length;
      for (const unit of link.units) unit.progress += delta;
    }
  }

  /** Combats sur les paires de liens opposés (A → B et B → A) entre tours adverses. */
  private fight(): void {
    for (const forward of this.links) {
      if (forward.from > forward.to) continue;
      const backward = this.linkBetween(forward.to, forward.from);
      if (!backward) continue;
      const a = this.towers[forward.from];
      const b = this.towers[forward.to];
      if (a.owner === b.owner) continue;
      const f = forward.units;
      const r = backward.units;
      while (f.length && r.length && f[0].progress + r[0].progress >= 1) {
        const x = f[0];
        const y = r[0];
        const t = (x.progress + (1 - y.progress)) / 2;
        this.events.push({ kind: 'clash', x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        x.hp -= y.power;
        y.hp -= x.power;
        if (x.hp <= 0) f.shift();
        if (y.hp <= 0) r.shift();
      }
    }
  }

  private arrive(): void {
    for (const link of [...this.links]) {
      while (link.alive && link.units.length && link.units[0].progress >= 1) {
        const unit = link.units.shift() as Unit;
        this.land(unit, this.towers[link.to]);
      }
    }
  }

  private land(unit: Unit, target: Tower): void {
    if (target.owner === unit.owner) {
      target.garrison = Math.min(MAX_GARRISON, target.garrison + 1);
    } else if (target.garrison > 0) {
      target.garrison = Math.max(0, target.garrison - unit.power);
    } else {
      this.capture(target, unit.owner);
    }
  }

  private capture(tower: Tower, owner: Side): void {
    for (const link of this.linksFrom(tower.id)) this.removeLink(link);
    tower.owner = owner;
    tower.garrison = 1;
    tower.genAcc = 0;
    this.events.push({ kind: 'capture', x: tower.x, y: tower.y, owner });
    const loser = otherSide(owner);
    if (this.towersOf(loser).length === 0) this.winner = owner;
  }
}
