import { Character } from './game.models';
import {
  STARTING_EQUIPMENT,
  addItem,
  applyGrants,
  arrowCount,
  backpackLoad,
  removeItem,
  requiresMeal,
  resolveMeal,
  useItem,
  weaponCount,
} from './equipment';
import { SERIES_RULES, effectiveCombatSkill, newCharacter } from './rules';

const kai = SERIES_RULES.kai;

function hero(overrides: Partial<Character> = {}): Character {
  return { ...newCharacter('kai', 5, 5), ...overrides };
}

describe('equipment', () => {
  it('livre 1 : hache, 1 Repas, carte et or = tirage', () => {
    const eq = STARTING_EQUIPMENT['01fftd'];
    const { character } = applyGrants(
      hero(),
      [...eq.fixed, { slot: 'gold', amount: eq.goldBase + 7 }],
      kai,
    );
    expect(character.weapons).toEqual(['Axe']);
    expect(character.meals).toBe(1);
    expect(character.specialItems).toEqual(['Map of Sommerlund']);
    expect(character.gold).toBe(7);
  });

  it('livre 1 : la table d’objets est indexée par le tirage 0-9', () => {
    const pick = STARTING_EQUIPMENT['01fftd'].pick;
    expect(pick.mode === 'random' && pick.table.map((o) => o.label)).toEqual([
      'Broadsword',
      'Sword',
      'Helmet',
      'Two Meals',
      'Chainmail Waistcoat',
      'Mace',
      'Healing Potion',
      'Quarterstaff',
      'Spear',
      '12 Gold Crowns',
    ]);
  });

  it('les objets de protection augmentent l’ENDURANCE totale et courante, et la retirent', () => {
    const { character } = addItem(hero(), 'specialItems', 'Chainmail Waistcoat', kai);
    expect([character.endurance, character.enduranceMax]).toEqual([29, 29]);
    const removed = removeItem(character, 'specialItems', 0);
    expect([removed.endurance, removed.enduranceMax]).toEqual([25, 25]);
  });

  it('le bouclier ajoute 2 en HABILETÉ de combat', () => {
    const c = hero({ weapons: ['Axe'], specialItems: ['Shield'] });
    expect(effectiveCombatSkill(c, { modifier: 0, useMindblast: false }).total).toBe(17);
  });

  it('refuse une 3e arme et un sac à dos plein (Repas compris)', () => {
    expect(addItem(hero({ weapons: ['Axe', 'Sword'] }), 'weapons', 'Mace', kai).error).toBe(
      'weaponsFull',
    );
    const full = hero({ backpack: ['Rope', 'Rope', 'Rope'], meals: 5 });
    expect(backpackLoad(full)).toBe(8);
    expect(addItem(full, 'backpack', 'Rope', kai).error).toBe('backpackFull');
  });

  it('une potion rend 4 END sans dépasser le total et disparaît', () => {
    const c = useItem(hero({ endurance: 23, backpack: ['Healing Potion'] }), 0);
    expect(c.endurance).toBe(25);
    expect(c.backpack).toEqual([]);
  });

  it('l’or est plafonné à 50', () => {
    const { character } = applyGrants(hero({ gold: 45 }), [{ slot: 'gold', amount: 12 }], kai);
    expect(character.gold).toBe(50);
  });

  it('compte les armes d’une sélection', () => {
    const pick = STARTING_EQUIPMENT['02fotw'].pick;
    if (pick.mode !== 'choose') throw new Error('mode');
    expect(weaponCount([pick.options[0], pick.options[2], pick.options[4]])).toBe(2);
  });

  it('repas : Repas consommé, Chasse gratuite, ou −3 END', () => {
    const c = hero({ meals: 1 });
    expect(resolveMeal(c, 'meal').meals).toBe(0);
    expect(resolveMeal(c, 'hunting')).toEqual(c);
    expect(resolveMeal(c, 'starve').endurance).toBe(22);
  });

  it('détecte l’obligation de manger dans le texte', () => {
    expect(requiresMeal('You are hungry and must now eat a Meal or lose 3 ENDURANCE points.')).toBe(
      true,
    );
    expect(requiresMeal('You may eat a Meal here if you wish.')).toBe(false);
  });
});

describe('flèches', () => {
  const c = (specialItems: string[], arrows?: number) => ({
    ...newCharacter('magnakai', 5, 5),
    specialItems,
    ...(arrows === undefined ? {} : { arrows }),
  });
  it('0 sans Quiver, 6 dans un Quiver neuf, sinon le compte tenu', () => {
    expect(arrowCount(c([]))).toBe(0);
    expect(arrowCount(c(['Quiver']))).toBe(6);
    expect(arrowCount(c(['quiver'], 2))).toBe(2);
    expect(arrowCount(c(['Quiver'], 0))).toBe(0);
    expect(arrowCount(c(['Quiver (6 Arrows)'], 3))).toBe(3);
    expect(arrowCount(c(['Carquois'], 4))).toBe(4);
    expect(arrowCount(c(['Quiver of Plenty'], 4))).toBe(4);
  });
});
