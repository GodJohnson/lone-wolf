import { describe, expect, it } from 'vitest';
import { TowerWarEngine } from './tower-war.engine';
import { MapDef, TowerSpec } from './tower-war.models';
import { pointSegmentDistance, segmentsIntersect } from './tower-war.geometry';
import { MAPS } from './tower-war.maps';

/** Fixtures inventées : A (joueur) et B (IA) distantes de 22 (1 s de trajet), C neutre au milieu. */
const tower = (x: number, y: number, owner: TowerSpec['owner'], garrison: number): TowerSpec => ({
  x,
  y,
  owner,
  garrison,
});

function engineOf(...towers: TowerSpec[]): TowerWarEngine {
  return new TowerWarEngine({ id: 'test', towers } satisfies MapDef);
}

function run(engine: TowerWarEngine, seconds: number, dt = 0.05): void {
  for (let t = 0; t < seconds - 1e-9; t += dt) engine.step(dt);
}

describe('génération', () => {
  it('une tour de niveau 1 génère 1 unité par seconde', () => {
    const e = engineOf(tower(0, 0, 'player', 5), tower(50, 0, 'ai', 5));
    run(e, 3);
    expect(e.towers[0].garrison).toBe(8);
  });

  it('le niveau suit la garnison et accélère la génération (niveau 2 : 2/s)', () => {
    const e = engineOf(tower(0, 0, 'player', 15), tower(50, 0, 'ai', 5));
    expect(e.level(e.towers[0])).toBe(2);
    run(e, 2);
    expect(e.towers[0].garrison).toBe(19);
  });

  it('une tour neutre ne génère rien', () => {
    const e = engineOf(
      tower(0, 0, 'player', 5),
      tower(50, 0, 'ai', 5),
      tower(25, 40, 'neutral', 4),
    );
    run(e, 5);
    expect(e.towers[2].garrison).toBe(4);
  });

  it('la garnison est plafonnée à 99', () => {
    const e = engineOf(tower(0, 0, 'player', 98), tower(50, 0, 'ai', 5));
    run(e, 5);
    expect(e.towers[0].garrison).toBe(99);
  });
});

describe('liens', () => {
  it('refuse un lien depuis une tour qui n’appartient pas au camp, vers soi-même ou en double', () => {
    const e = engineOf(
      tower(0, 0, 'player', 5),
      tower(50, 0, 'ai', 5),
      tower(25, 40, 'neutral', 4),
    );
    expect(e.addLink(1, 0, 'player')).toBe(false);
    expect(e.addLink(2, 0, 'player')).toBe(false);
    expect(e.addLink(0, 0, 'player')).toBe(false);
    expect(e.addLink(0, 1, 'player')).toBe(true);
    expect(e.addLink(0, 1, 'player')).toBe(false);
  });

  it('une tour peut avoir plusieurs liens sortants', () => {
    const e = engineOf(
      tower(0, 0, 'player', 20),
      tower(50, 0, 'ai', 5),
      tower(25, 40, 'neutral', 4),
    );
    expect(e.addLink(0, 1, 'player')).toBe(true);
    expect(e.addLink(0, 2, 'player')).toBe(true);
    expect(e.linksFrom(0)).toHaveLength(2);
  });

  it('un lien émet 1 unité par seconde, prélevée sur la garnison', () => {
    const e = engineOf(tower(0, 0, 'player', 10), tower(100, 0, 'ai', 50));
    e.addLink(0, 1, 'player');
    run(e, 3.5);
    // 1 unité immédiate puis 1/s : 4 émises ; la tour en regénère 1/s (3 entiers en 3,5 s).
    expect(e.unitCount('player')).toBe(4);
    expect(e.towers[0].garrison).toBe(10 + 3 - 4);
  });

  it('un niveau 3 avec 2 liens : 1 unité par lien et par seconde, +3 de génération', () => {
    const e = engineOf(
      tower(0, 0, 'player', 40),
      tower(100, 0, 'ai', 90),
      tower(0, 100, 'neutral', 90),
    );
    e.addLink(0, 1, 'player');
    e.addLink(0, 2, 'player');
    run(e, 4.5);
    expect(e.linksFrom(0).map((l) => l.units.length)).toEqual([5, 5]);
  });

  it('rien ne sort d’une garnison vide, puis l’émission reprend', () => {
    const e = engineOf(tower(0, 0, 'player', 0), tower(100, 0, 'ai', 50));
    e.addLink(0, 1, 'player');
    e.step(0.1);
    expect(e.unitCount('player')).toBe(0);
    run(e, 1);
    expect(e.unitCount('player')).toBeGreaterThan(0);
  });

  it('cutLinks supprime les liens du camp touchés par le trait, pas ceux de l’adversaire', () => {
    const e = engineOf(tower(0, 0, 'player', 20), tower(100, 0, 'ai', 20));
    e.addLink(0, 1, 'player');
    e.addLink(1, 0, 'ai');
    expect(e.cutLinks('player', { x: 50, y: -10 }, { x: 50, y: 10 })).toBe(1);
    expect(e.linkBetween(0, 1)).toBeUndefined();
    expect(e.linkBetween(1, 0)).toBeDefined();
    expect(e.cutLinks('player', { x: 50, y: 30 }, { x: 50, y: 40 })).toBe(0);
  });
});

describe('arrivée des unités', () => {
  it('sur une tour alliée, chaque unité ajoute 1', () => {
    const e = engineOf(
      tower(0, 0, 'player', 10),
      tower(22, 0, 'player', 3),
      tower(100, 100, 'ai', 5),
    );
    e.addLink(0, 1, 'player');
    run(e, 1.2);
    // 1 unité arrivée (+1) ; la tour 1 génère 1/s (+1) : 3 + 1 + 1.
    expect(e.towers[1].garrison).toBe(5);
  });

  it('sur une tour neutre ou adverse, chaque unité retire 1', () => {
    const e = engineOf(
      tower(0, 0, 'player', 10),
      tower(22, 0, 'neutral', 5),
      tower(100, 100, 'ai', 5),
    );
    e.addLink(0, 1, 'player');
    run(e, 3);
    expect(e.towers[1].owner).toBe('neutral');
    expect(e.towers[1].garrison).toBeLessThan(5);
  });

  it('une garnison vide est capturée par l’unité qui arrive (garnison 1), les liens sortants tombent', () => {
    const e = engineOf(
      tower(0, 0, 'player', 30),
      tower(22, 0, 'neutral', 1),
      tower(22, 60, 'ai', 5),
      tower(100, 100, 'ai', 50),
    );
    e.addLink(0, 1, 'player');
    run(e, 4);
    expect(e.towers[1].owner).toBe('player');
    expect(e.drainEvents().some((ev) => ev.kind === 'capture')).toBe(true);
  });

  it('capturer une tour supprime ses liens sortants et les unités en transit', () => {
    const e = engineOf(
      tower(0, 0, 'player', 40),
      tower(22, 0, 'ai', 0),
      tower(100, 0, 'neutral', 30),
      tower(100, 100, 'ai', 50),
    );
    e.addLink(1, 2, 'ai');
    e.addLink(0, 1, 'player');
    run(e, 1.5);
    expect(e.towers[1].owner).toBe('player');
    expect(e.linksFrom(1)).toHaveLength(0);
  });

  it('une partie est gagnée quand l’adversaire n’a plus de tour', () => {
    const e = engineOf(tower(0, 0, 'player', 30), tower(22, 0, 'ai', 0));
    e.addLink(0, 1, 'player');
    run(e, 2);
    expect(e.winner).toBe('player');
    expect(e.addLink(0, 1, 'player')).toBe(false);
  });
});

describe('combat sur liens opposés', () => {
  it('deux unités adverses qui se croisent meurent toutes les deux', () => {
    const e = engineOf(tower(0, 0, 'player', 10), tower(44, 0, 'ai', 10));
    e.addLink(0, 1, 'player');
    e.addLink(1, 0, 'ai');
    // Une unité chacune au départ ; elles se croisent au milieu après 1 s (22 u/s sur 44).
    run(e, 0.9);
    expect(e.unitCount('player')).toBe(1);
    expect(e.unitCount('ai')).toBe(1);
    run(e, 0.2);
    expect(e.drainEvents().filter((ev) => ev.kind === 'clash').length).toBeGreaterThanOrEqual(1);
    expect(e.towers[0].garrison + e.towers[1].garrison).toBeGreaterThan(0);
  });

  it('les unités qui se sont battues n’atteignent pas leur cible', () => {
    const e = engineOf(tower(0, 0, 'player', 2), tower(44, 0, 'ai', 2));
    e.addLink(0, 1, 'player');
    e.addLink(1, 0, 'ai');
    run(e, 2.1);
    // Chaque camp a émis 2 unités qui se sont annulées deux à deux : aucune garnison n’a baissé
    // du fait d’une arrivée (génération seule : 2 + 2 − 2 émises).
    expect(e.towers[0].owner).toBe('player');
    expect(e.towers[1].owner).toBe('ai');
  });

  it('pas de combat entre liens opposés d’un même camp', () => {
    const e = engineOf(
      tower(0, 0, 'player', 10),
      tower(44, 0, 'player', 10),
      tower(0, 90, 'ai', 5),
    );
    e.addLink(0, 1, 'player');
    e.addLink(1, 0, 'player');
    run(e, 1.5);
    expect(e.drainEvents().some((ev) => ev.kind === 'clash')).toBe(false);
  });
});

describe('géométrie', () => {
  it('détecte le croisement de deux segments', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true);
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false);
  });

  it('distance d’un point à un segment', () => {
    expect(pointSegmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(pointSegmentDistance({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
});

describe('cartes', () => {
  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s : symétrique, chaque camp a le même départ',
    (_id, map) => {
      const count = (o: string) => map.towers.filter((t) => t.owner === o);
      expect(count('player').length).toBe(count('ai').length);
      expect(count('player').length).toBeGreaterThan(0);
      for (const t of map.towers) {
        const mirror = map.towers.find(
          (m) => Math.abs(m.x - (100 - t.x)) < 1e-9 && Math.abs(m.y - (150 - t.y)) < 1e-9,
        );
        expect(mirror?.garrison).toBe(t.garrison);
      }
    },
  );

  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s : tours dans le monde et assez espacées',
    (_id, map) => {
      for (const a of map.towers) {
        expect(a.x).toBeGreaterThanOrEqual(10);
        expect(a.x).toBeLessThanOrEqual(90);
        expect(a.y).toBeGreaterThanOrEqual(10);
        expect(a.y).toBeLessThanOrEqual(140);
        for (const b of map.towers) {
          if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(18);
        }
      }
    },
  );

  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s : aucune tour ne masque une liaison de moins de 60',
    (_id, map) => {
      for (const a of map.towers) {
        for (const b of map.towers) {
          if (a === b) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) > 60) continue;
          for (const c of map.towers) {
            if (c === a || c === b) continue;
            expect(pointSegmentDistance(c, a, b)).toBeGreaterThan(6);
          }
        }
      }
    },
  );
});
