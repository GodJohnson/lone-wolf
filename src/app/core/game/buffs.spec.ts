import { Character } from './game.models';
import { buffsBonus, swallow, swallowInCombat } from './buffs';
import { itemEffect } from './equipment';
import { effectiveCombatSkill, newCharacter, startCombat } from './rules';

const hero = (over: Partial<Character> = {}): Character => ({
  ...newCharacter('magnakai', 5, 5),
  weapons: ['Sword'],
  backpack: ['Alether Berries', 'Rope', 'Alether Berries'],
  ...over,
});
const enemy = { name: 'Rat', combatSkill: 15, endurance: 20 };
const cs = (c: Character, combat: Parameters<typeof effectiveCombatSkill>[1]) =>
  effectiveCombatSkill(c, combat);

describe('buffs', () => {
  it('reconnaît les baies, aussi sous « a handful of »', () => {
    expect(itemEffect('Alether Berries')?.buff).toEqual({ combatSkill: 2 });
    expect(itemEffect('A handful of Alether Berries')?.buff).toEqual({ combatSkill: 2 });
    expect(itemEffect('Rope')?.buff).toBeUndefined();
  });

  it('avaler : l’objet quitte le sac, l’effet attend le prochain combat', () => {
    const r = swallow(hero(), 0);
    expect(r.error).toBeUndefined();
    expect(r.character.backpack).toEqual(['Rope', 'Alether Berries']);
    expect(r.character.buffs).toEqual([{ name: 'Alether Berries', combatSkill: 2 }]);
    expect(swallow(hero(), 1).error).toBe('notBuff');
  });

  it('une seule poignée par combat : un second effet identique est refusé', () => {
    const first = swallow(hero(), 0).character;
    const second = swallow(first, 1);
    expect(second.error).toBe('buffActive');
    expect(second.character).toBe(first);
  });

  it('le combat reprend les effets prêts et en tient compte dans l’HABILETÉ', () => {
    const ready = swallow(hero(), 0).character;
    const combat = startCombat(1, 0, enemy, ready);
    expect(combat.buffs).toEqual([{ name: 'Alether Berries', combatSkill: 2 }]);
    expect(buffsBonus(combat.buffs)).toBe(2);
    const base = cs(hero(), { modifier: 0, useMindblast: false }).total;
    expect(cs(ready, { modifier: 0, useMindblast: false, buffs: combat.buffs }).total).toBe(
      base + 2,
    );
    expect(startCombat(1, 0, enemy, hero()).buffs).toBeUndefined();
  });

  it('avaler en plein combat (avant le premier assaut) vaut pour ce combat seulement', () => {
    const combat = startCombat(1, 0, enemy, hero());
    const r = swallowInCombat(hero(), combat, 0);
    expect(r.error).toBeUndefined();
    expect(r.combat.buffs).toEqual([{ name: 'Alether Berries', combatSkill: 2 }]);
    expect(r.character.buffs).toBeUndefined();
    expect(r.character.backpack).toEqual(['Rope', 'Alether Berries']);
    expect(swallowInCombat(r.character, r.combat, 1).error).toBe('buffActive');
  });
});
