import { Character } from './game.models';
import {
  STARTING_EQUIPMENT,
  startingEquipmentFor,
  addItem,
  applyGrants,
  arrowCount,
  backpackLoad,
  configureItemSizes,
  itemSize,
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
    const full = hero({ backpack: ['Torch', 'Torch', 'Torch'], meals: 5 });
    expect(backpackLoad(full)).toBe(8);
    expect(addItem(full, 'backpack', 'Torch', kai).error).toBe('backpackFull');
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

describe('places dans le sac', () => {
  const rules = SERIES_RULES.kai;
  const pack = (backpack: string[], meals = 0) => ({
    ...newCharacter('kai', 5, 5),
    backpack,
    meals,
  });
  afterEach(() => configureItemSizes({}));

  it('une corde prend 2 places, comme les autres objets encombrants du texte', () => {
    expect(itemSize('Rope')).toBe(2);
    expect(itemSize('30 Feet of Rope')).toBe(2);
    expect(itemSize('Sleeping Furs')).toBe(2);
    expect(itemSize('Tent')).toBe(3);
    expect(itemSize('Shovel')).toBe(2);
    expect(itemSize('Tinderbox')).toBe(1);
  });

  it('la charge du sac additionne les tailles et les Repas', () => {
    expect(backpackLoad(pack(['Rope', 'Tinderbox'], 2))).toBe(5);
  });

  it('refuse un objet dont la taille dépasse la place restante', () => {
    const c = pack(['a', 'b', 'c', 'd', 'e', 'f', 'g']); // 7 places sur 8
    expect(addItem(c, 'backpack', 'Rope', rules).error).toBe('backpackFull');
    expect(addItem(c, 'backpack', 'Torch', rules).error).toBeUndefined();
  });

  it('la taille choisie par le joueur l’emporte sur celle du livre', () => {
    configureItemSizes({ rope: 3, lantern: 2 });
    expect(itemSize('Rope')).toBe(3);
    expect(itemSize('Lantern')).toBe(2);
    expect(backpackLoad(pack(['Rope', 'Lantern']))).toBe(5);
  });
});

const optionLabels = (id: string): string[] => {
  const pick = startingEquipmentFor(id)!.pick;
  return pick.mode === 'choose' ? pick.options.map((o) => o.label) : [];
};

describe('équipement de départ des livres 7 à 12', () => {
  it('livres 7 à 10 : carte, or 10 + tirage, 5 objets au choix', () => {
    for (const id of ['07cd', '08tjoh', '09tcof', '10tdot']) {
      const eq = startingEquipmentFor(id)!;
      expect(eq.goldBase).toBe(10);
      expect(eq.fixed).toHaveLength(1);
      expect(eq.fixed[0]).toMatchObject({ slot: 'specialItems' });
      expect(eq.pick).toMatchObject({ mode: 'choose', count: 5 });
    }
  });

  it('livres 7 à 9 offrent des Fireseeds, le livre 10 une Potion of Alether', () => {
    expect(optionLabels('07cd')).toContain('3 Fireseeds');
    expect(optionLabels('10tdot')).toContain('Potion of Alether');
    expect(optionLabels('10tdot')).not.toContain('3 Fireseeds');
    expect(optionLabels('07cd')).toContain('Quiver');
  });

  it('livre 11 : étape sautée pour un héros reporté, 2 Repas et 6 objets sinon', () => {
    const eq = startingEquipmentFor('11tpot')!;
    expect(eq.skipWhenCarried).toBe(true);
    expect(eq.fixed).toEqual([{ slot: 'meals', count: 2 }]);
    expect(eq.pick).toMatchObject({ count: 6 });
  });

  it('livre 12 : 6 objets, dont 4 Repas, Quarterstaff et Axe', () => {
    expect(startingEquipmentFor('12tmod')!.pick).toMatchObject({ count: 6 });
    expect(optionLabels('12tmod')).toEqual(
      expect.arrayContaining(['4 Meals', 'Quarterstaff', 'Axe']),
    );
  });
});
