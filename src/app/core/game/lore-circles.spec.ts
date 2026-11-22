import { Character } from './game.models';
import { completedCircles, loreBonus, syncLoreBonus } from './lore-circles';
import { newCharacter } from './rules';

const hero = (disciplines: string[], over: Partial<Character> = {}): Character => ({
  ...newCharacter('magnakai', 5, 5),
  disciplines,
  ...over,
});

describe('lore-circles', () => {
  it('un cercle n’est accompli que si toutes ses Disciplines sont possédées', () => {
    expect(completedCircles(hero(['Weaponmastery'])).length).toBe(0);
    expect(completedCircles(hero(['weaponmastery', 'HUNTMASTERY'])).map((c) => c.name)).toEqual([
      'Circle of Fire',
    ]);
  });

  it('additionne les bonus (Huntmastery sert au Feu et à Solaris)', () => {
    const all = hero(['Weaponmastery', 'Huntmastery', 'Invisibility', 'Pathsmanship']);
    expect(loreBonus(all)).toEqual({ cs: 2, ep: 5 }); // Feu +1/+2, Solaris +1/+3
    expect(loreBonus(hero(['Psi-surge', 'Psi-screen', 'Nexus', 'Divination']))).toEqual({
      cs: 3,
      ep: 3,
    });
    expect(loreBonus(hero(['Animal Control', 'Curing']))).toEqual({ cs: 0, ep: 3 });
  });

  it('ajoute le bonus à HAB, END de base et END courante, une seule fois', () => {
    const base = hero(['Animal Control', 'Curing'], { endurance: 22, enduranceMax: 25 });
    const synced = syncLoreBonus(base);
    expect([synced.combatSkill, synced.enduranceMax, synced.endurance]).toEqual([
      base.combatSkill,
      28,
      25,
    ]);
    expect(synced.loreApplied).toEqual({ cs: 0, ep: 3 });
    expect(syncLoreBonus(synced)).toBe(synced);
  });

  it('retire le bonus quand une Discipline du cercle est ôtée', () => {
    const synced = syncLoreBonus(
      hero(['Weaponmastery', 'Huntmastery'], { enduranceMax: 25, endurance: 25 }),
    );
    const lost = syncLoreBonus({ ...synced, disciplines: ['Weaponmastery'] });
    expect(lost.combatSkill).toBe(synced.combatSkill - 1);
    expect(lost.enduranceMax).toBe(25);
    expect(lost.endurance).toBe(25);
    expect(lost.loreApplied).toEqual({ cs: 0, ep: 0 });
  });
});
