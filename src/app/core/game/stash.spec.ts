import { Character } from './game.models';
import { SERIES_RULES } from './rules';
import { discard, getBack, pickAll, putAside, stashCount } from './stash';

const rules = SERIES_RULES.kai;
const hero = (over: Partial<Character> = {}): Character => ({
  combatSkill: 15,
  endurance: 20,
  enduranceMax: 25,
  disciplines: [],
  weaponskill: null,
  weapons: ['Sword', 'Axe'],
  backpack: ['Rope', 'Potion'],
  specialItems: ['Helmet'],
  gold: 12,
  meals: 3,
  notes: '',
  ...over,
});

describe('stash', () => {
  it('met tout de côté : inventaire vide, réserve pleine', () => {
    const c = putAside(hero(), pickAll(hero()));
    expect([c.weapons, c.backpack, c.specialItems, c.gold, c.meals]).toEqual([[], [], [], 0, 0]);
    expect(c.stash).toEqual({
      weapons: ['Sword', 'Axe'],
      backpack: ['Rope', 'Potion'],
      specialItems: ['Helmet'],
      gold: 12,
      meals: 3,
    });
    expect(stashCount(c.stash)).toBe(7);
  });

  it('ne met de côté que la sélection', () => {
    const c = putAside(hero(), {
      weapons: [1],
      backpack: [],
      specialItems: [],
      gold: true,
      meals: false,
    });
    expect(c.weapons).toEqual(['Sword']);
    expect(c.stash?.weapons).toEqual(['Axe']);
    expect([c.gold, c.meals]).toEqual([0, 3]);
  });

  it('récupère un objet, ou le laisse de côté s’il ne rentre pas', () => {
    const aside = putAside(hero(), pickAll(hero()));
    const back = getBack(aside, rules, { slot: 'weapons', index: 0 });
    expect(back.character.weapons).toEqual(['Sword']);
    expect(back.character.stash?.weapons).toEqual(['Axe']);
    const full = { ...aside, weapons: ['A', 'B'] };
    const refused = getBack(full, rules, { slot: 'weapons', index: 0 });
    expect(refused.error).toBe('weaponsFull');
    expect(refused.character).toBe(full);
  });

  it('récupère l’or dans la limite du plafond et les Repas dans la limite du sac', () => {
    const base = putAside(hero(), pickAll(hero()));
    const aside = { ...base, gold: 30, stash: { ...base.stash!, gold: 45 } };
    const gold = getBack(aside, rules, 'gold').character;
    expect(gold.gold).toBe(50);
    expect(gold.stash?.gold).toBe(25);
    const crowded = { ...aside, backpack: Array.from({ length: 7 }, (_, i) => `x${i}`) };
    const meals = getBack(crowded, rules, 'meals');
    expect(meals.character.meals).toBe(1);
    expect(meals.character.stash?.meals).toBe(2);
    expect(meals.error).toBe('backpackFull');
  });

  it('abandonne un élément, et supprime la réserve quand elle est vide', () => {
    const one = putAside(
      hero({ weapons: ['Sword'], backpack: [], specialItems: [], gold: 0, meals: 0 }),
      {
        weapons: [0],
        backpack: [],
        specialItems: [],
        gold: false,
        meals: false,
      },
    );
    expect(discard(one, { slot: 'weapons', index: 0 }).stash).toBeUndefined();
  });
});
