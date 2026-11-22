import { describe, expect, it } from 'vitest';
import { Difficulty, TowerWarAi } from './tower-war.ai';
import { TowerWarEngine } from './tower-war.engine';
import { MAPS } from './tower-war.maps';

/** Générateur déterministe (mulberry32) pour des parties reproductibles. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function play(mapIndex: number, difficulty: Difficulty, seconds: number, seed = 1) {
  const engine = new TowerWarEngine(structuredClone(MAPS[mapIndex]));
  const ai = new TowerWarAi(engine, difficulty, seeded(seed));
  for (let t = 0; t < seconds && !engine.winner; t += 1 / 30) {
    ai.update(1 / 30);
    engine.step(1 / 30);
  }
  return engine;
}

describe('IA', () => {
  it.each(MAPS.map((_, i) => i))('ouvre des liens et prend des tours neutres (carte %i)', (i) => {
    const engine = play(i, 'normal', 60);
    expect(engine.towersOf('ai').length).toBeGreaterThan(
      MAPS[i].towers.filter((t) => t.owner === 'ai').length,
    );
  });

  it('ne trace que des liens depuis ses propres tours et respecte le maximum par tour', () => {
    const engine = play(2, 'easy', 40);
    for (const link of engine.links) {
      const source = engine.towers[link.from];
      if (source.owner !== 'ai') continue;
      expect(engine.linksFrom(source.id).length).toBeLessThanOrEqual(1);
    }
  });

  it('est reproductible avec la même graine', () => {
    const a = play(1, 'hard', 45, 7);
    const b = play(1, 'hard', 45, 7);
    expect(a.towers.map((t) => [t.owner, t.garrison])).toEqual(
      b.towers.map((t) => [t.owner, t.garrison]),
    );
  });

  it('un joueur passif finit par perdre contre l’IA difficile', () => {
    const engine = play(0, 'hard', 600, 3);
    expect(engine.winner).toBe('ai');
  });
});
