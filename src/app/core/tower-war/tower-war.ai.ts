import { Side, Tower, otherSide } from './tower-war.models';
import { TowerWarEngine } from './tower-war.engine';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Profile {
  /** Délai moyen entre deux décisions (s). */
  interval: number;
  /** Liens sortants maximum par tour. */
  maxLinks: number;
  /** Garnison minimale d'une tour pour qu'elle ouvre un nouveau lien. */
  minGarrison: number;
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { interval: 2.4, maxLinks: 1, minGarrison: 8 },
  normal: { interval: 1.4, maxLinks: 2, minGarrison: 6 },
  hard: { interval: 0.8, maxLinks: 3, minGarrison: 5 },
};

/** Garnison au-delà de laquelle une tour alliée n'a plus besoin de renforts. */
const WELL_STOCKED = 22;

/**
 * Adversaire machine : une heuristique, pas de recherche. Il joue avec les mêmes actions que le
 * joueur (`addLink` / `removeLink`) mais voit toute la carte. À chaque décision, chaque tour :
 * 1. coupe les liens devenus inutiles (renfort vers une tour bien garnie) ;
 * 2. renforce une tour alliée attaquée, si elle est à portée d'une voisine solide ;
 * 3. sinon attaque la meilleure cible, d'après sa valeur, sa distance et sa garnison.
 */
export class TowerWarAi {
  private readonly profile: Profile;
  private wait: number;

  constructor(
    private readonly engine: TowerWarEngine,
    difficulty: Difficulty,
    private readonly random: () => number = Math.random,
    private readonly side: Side = 'ai',
  ) {
    this.profile = PROFILES[difficulty];
    this.wait = this.profile.interval;
  }

  update(dt: number): void {
    if (this.engine.winner) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = this.profile.interval * (0.7 + this.random() * 0.6);
    this.think();
  }

  private think(): void {
    const mine = this.shuffled(this.engine.towersOf(this.side));
    for (const tower of mine) {
      this.prune(tower);
      if (!this.reinforce(tower)) this.attack(tower);
    }
  }

  private prune(tower: Tower): void {
    const outgoing = this.engine.linksFrom(tower.id);
    // Garnison presque vide : une seule unité adverse suffirait à capturer la tour. On ferme un lien.
    if (tower.garrison <= 2 && outgoing.length > 1)
      this.engine.removeLink(outgoing[outgoing.length - 1]);
    for (const link of this.engine.linksFrom(tower.id)) {
      const target = this.engine.towers[link.to];
      if (
        target.owner === this.side &&
        target.garrison >= WELL_STOCKED &&
        !this.threatened(target)
      ) {
        this.engine.removeLink(link);
      }
    }
  }

  /** Unités adverses en route vers `tower`, ou lien adverse qui la vise. */
  private incomingThreat(tower: Tower): number {
    const enemy = otherSide(this.side);
    return this.engine.links
      .filter((l) => l.to === tower.id && this.engine.towers[l.from].owner === enemy)
      .reduce((n, l) => n + l.units.length + 2, 0);
  }

  private threatened(tower: Tower): boolean {
    return this.incomingThreat(tower) > 0;
  }

  private reinforce(tower: Tower): boolean {
    if (tower.garrison < this.profile.minGarrison || !this.canOpenLink(tower)) return false;
    const needy = this.engine
      .towersOf(this.side)
      .filter((t) => t !== tower && !this.engine.linkBetween(tower.id, t.id))
      .filter((t) => this.incomingThreat(t) > t.garrison * 0.5)
      .sort((a, b) => this.distance(tower, a) - this.distance(tower, b))[0];
    return !!needy && this.engine.addLink(tower.id, needy.id, this.side);
  }

  private attack(tower: Tower): void {
    if (tower.garrison < this.profile.minGarrison || !this.canOpenLink(tower)) return;
    let best: { target: Tower; score: number } | null = null;
    for (const target of this.engine.towers) {
      if (target.owner === this.side || this.engine.linkBetween(tower.id, target.id)) continue;
      const score = this.score(tower, target);
      if (score > 0 && (!best || score > best.score)) best = { target, score };
    }
    if (best) this.engine.addLink(tower.id, best.target.id, this.side);
  }

  private canOpenLink(tower: Tower): boolean {
    return this.engine.linksFrom(tower.id).length < this.profile.maxLinks;
  }

  /** Attrait d'une cible : valeur / (coût × distance). Négatif ou nul : on s'abstient. */
  private score(from: Tower, target: Tower): number {
    const enemy = target.owner === otherSide(this.side);
    // Les unités déjà dirigées vers la cible comptent : on concentre les attaques.
    const alreadySent = this.engine.links
      .filter((l) => l.to === target.id && this.engine.towers[l.from].owner === this.side)
      .reduce((n, l) => n + 3 + l.units.length, 0);
    const cost = target.garrison + (enemy ? this.engine.level(target) * 2 : 0) - alreadySent;
    const affordable = from.garrison + alreadySent;
    if (cost > affordable * 1.5 + 2) return 0;
    const value = enemy ? 14 : 10;
    const distance = this.distance(from, target);
    return (value + this.random()) / ((Math.max(cost, 0) + 4) * (1 + distance / 40));
  }

  private distance(a: Tower, b: Tower): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private shuffled<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
