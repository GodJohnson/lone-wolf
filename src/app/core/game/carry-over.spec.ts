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

  it('le livre suivant n’existe que dans la série Kaï (1 à 5)', () => {
    expect(nextBookNumber(1, SERIES_RULES.kai)).toBe(2);
    expect(nextBookNumber(4, SERIES_RULES.kai)).toBe(5);
    expect(nextBookNumber(5, SERIES_RULES.kai)).toBeNull();
  });
});
