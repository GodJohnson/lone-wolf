import { alreadyOwned, carryOver, nextBookNumber } from './carry-over';
import { Character } from './game.models';
import { SERIES_RULES, newCharacter } from './rules';

const hero = (): Character => ({
  ...newCharacter('kai', 5, 6),
  endurance: 9,
  enduranceMax: 30,
  disciplines: ['healing', 'Hunting'],
  weaponskill: 'Axe',
  weapons: ['Axe', 'Sword'],
  backpack: ['Rope'],
  specialItems: ['Map of Sommerlund', 'Chainmail Waistcoat'],
  gold: 31,
  meals: 3,
  notes: 'à garder',
});

describe('carryOver', () => {
  const carried = carryOver(hero(), ['Healing', 'Hunting', 'Tracking']);

  it('reporte HAB, END de départ, disciplines (noms du livre), armes, objets spéciaux, or et notes', () => {
    expect(carried.character).toMatchObject({
      combatSkill: 15,
      enduranceMax: 30,
      endurance: 30,
      weaponskill: 'Axe',
      weapons: ['Axe', 'Sword'],
      specialItems: ['Map of Sommerlund', 'Chainmail Waistcoat'],
      gold: 31,
      notes: 'à garder',
    });
    expect(carried.disciplines).toEqual(['Healing', 'Hunting']);
  });

  it('ne reporte ni le sac à dos ni les Repas', () => {
    expect(carried.character.backpack).toEqual([]);
    expect(carried.character.meals).toBe(0);
  });

  it('détecte les objets déjà possédés, sans tenir compte de la casse', () => {
    expect(alreadyOwned(carried.character, 'map of sommerlund')).toBe(true);
    expect(alreadyOwned(carried.character, 'Seal of Hammerdal')).toBe(false);
  });

  it('le livre suivant : série Kaï (1 à 5, le 6 ouvrant la série Magnakai) puis Magnakai (6 à 11)', () => {
    expect(nextBookNumber(1, SERIES_RULES.kai)).toBe(2);
    expect(nextBookNumber(5, SERIES_RULES.kai)).toBe(6);
    expect(nextBookNumber(6, SERIES_RULES.kai)).toBeNull();
    expect(nextBookNumber(6, SERIES_RULES.magnakai)).toBe(7);
    expect(nextBookNumber(11, SERIES_RULES.magnakai)).toBe(12);
    expect(nextBookNumber(12, SERIES_RULES.magnakai)).toBeNull();
    expect(nextBookNumber(5, null)).toBeNull();
  });

  it('passage Kaï → Magnakai : disciplines et maîtrise d’arme à rechoisir, le reste est reporté', () => {
    const next = carryOver(hero(), ['Weaponmastery', 'Curing'], true);
    expect(next.disciplines).toEqual([]);
    expect(next.character).toMatchObject({
      combatSkill: 15,
      enduranceMax: 30,
      endurance: 30,
      weaponskill: null,
      weapons: ['Axe', 'Sword'],
      specialItems: ['Map of Sommerlund', 'Chainmail Waistcoat'],
      gold: 31,
    });
    expect(next.character.backpack).toEqual([]);
  });
});
