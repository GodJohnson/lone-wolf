import type { Character } from './game.models';
import type { SeriesRules } from './rules';

/**
 * Équipement : effets des objets connus, équipement de départ par livre, et opérations
 * d'inventaire qui respectent les capacités et appliquent les effets.
 *
 * Les données de départ sont relevées dans la page « Equipment » de chaque livre. Comme pour la
 * table de combat, ce sont des données de mécanique (noms d'objets, nombres), pas le texte du livre.
 */

export type ItemSlot = 'weapons' | 'backpack' | 'specialItems';

export interface ItemEffect {
  /** Bonus permanent d'ENDURANCE (total et courante) tant que l'objet est porté. */
  endurance?: number;
  /** Bonus d'HABILETÉ en combat tant que l'objet est porté. */
  combatSkill?: number;
  /** Objet consommable qui rend de l'ENDURANCE (potion). */
  heal?: number;
}

const ITEM_EFFECTS: Record<string, ItemEffect> = {
  helmet: { endurance: 2 },
  'chainmail waistcoat': { endurance: 4 },
  'padded leather waistcoat': { endurance: 2 },
  shield: { combatSkill: 2 },
  /** Épée de Sommer : +8 HAB (le +2 Weaponskill avec une épée est compté à part, sans cumul). */
  sommerswerd: { combatSkill: 8 },
  'healing potion': { heal: 4 },
  'potion of laumspur': { heal: 4 },
  laumspur: { heal: 4 },
};

export function itemEffect(name: string): ItemEffect | null {
  return ITEM_EFFECTS[name.trim().toLowerCase()] ?? null;
}

/** Suggestions de saisie (noms anglais, comme dans les livres). */
export const KNOWN_ITEMS: Record<ItemSlot, readonly string[]> = {
  weapons: [
    'Axe',
    'Broadsword',
    'Dagger',
    'Mace',
    'Quarterstaff',
    'Short Sword',
    'Spear',
    'Sword',
    'Warhammer',
  ],
  backpack: ['Healing Potion', 'Potion of Laumspur', 'Rope', 'Blanket', 'Tinderbox'],
  specialItems: [
    'Helmet',
    'Chainmail Waistcoat',
    'Padded Leather Waistcoat',
    'Shield',
    'Sommerswerd',
    'Map of Sommerlund',
  ],
};

// ---------------------------------------------------------------------------
// Équipement de départ
// ---------------------------------------------------------------------------

export type Grant =
  | { slot: ItemSlot; name: string }
  | { slot: 'meals'; count: number }
  | { slot: 'gold'; amount: number };

export interface EquipmentOption {
  label: string;
  grants: Grant[];
}

export type StartingPick =
  | { mode: 'random'; table: readonly EquipmentOption[] }
  | { mode: 'choose'; count: number; options: readonly EquipmentOption[] };

export interface StartingEquipment {
  fixed: Grant[];
  /** Or de départ = `goldBase` + tirage. */
  goldBase: number;
  pick: StartingPick;
}

const weapon = (name: string): EquipmentOption => ({
  label: name,
  grants: [{ slot: 'weapons', name }],
});
const special = (name: string): EquipmentOption => ({
  label: name,
  grants: [{ slot: 'specialItems', name }],
});
const backpack = (name: string, count = 1): EquipmentOption => ({
  label: count > 1 ? `${count} × ${name}` : name,
  grants: Array.from({ length: count }, () => ({ slot: 'backpack' as const, name })),
});
const meals = (label: string, count: number): EquipmentOption => ({
  label,
  grants: [{ slot: 'meals', count }],
});

export const STARTING_EQUIPMENT: Record<string, StartingEquipment> = {
  '01fftd': {
    fixed: [
      { slot: 'weapons', name: 'Axe' },
      { slot: 'meals', count: 1 },
      { slot: 'specialItems', name: 'Map of Sommerlund' },
    ],
    goldBase: 0,
    pick: {
      mode: 'random',
      // Index = nombre tiré (0 à 9).
      table: [
        weapon('Broadsword'),
        weapon('Sword'),
        special('Helmet'),
        meals('Two Meals', 2),
        special('Chainmail Waistcoat'),
        weapon('Mace'),
        backpack('Healing Potion'),
        weapon('Quarterstaff'),
        weapon('Spear'),
        { label: '12 Gold Crowns', grants: [{ slot: 'gold', amount: 12 }] },
      ],
    },
  },
  '02fotw': {
    fixed: [
      { slot: 'specialItems', name: 'Map of Sommerlund' },
      { slot: 'specialItems', name: 'Seal of Hammerdal' },
    ],
    goldBase: 10,
    pick: {
      mode: 'choose',
      count: 2,
      options: [
        weapon('Sword'),
        weapon('Short Sword'),
        meals('Two Meals', 2),
        special('Chainmail Waistcoat'),
        weapon('Mace'),
        backpack('Healing Potion'),
        weapon('Quarterstaff'),
        weapon('Spear'),
        special('Shield'),
        weapon('Broadsword'),
      ],
    },
  },
  '03tcok': {
    fixed: [{ slot: 'specialItems', name: 'Map of Kalte' }],
    goldBase: 10,
    pick: {
      mode: 'choose',
      count: 2,
      options: [
        weapon('Sword'),
        weapon('Short Sword'),
        special('Padded Leather Waistcoat'),
        weapon('Spear'),
        weapon('Mace'),
        weapon('Warhammer'),
        weapon('Axe'),
        backpack('Potion of Laumspur'),
        weapon('Quarterstaff'),
        meals('Special Rations', 1),
        weapon('Broadsword'),
      ],
    },
  },
  '04tcod': {
    fixed: [
      { slot: 'specialItems', name: 'Map of the Southlands' },
      { slot: 'specialItems', name: 'Badge of Rank' },
    ],
    goldBase: 10,
    pick: {
      mode: 'choose',
      count: 6,
      options: [
        weapon('Warhammer'),
        weapon('Dagger'),
        backpack('Potion of Laumspur', 2),
        weapon('Sword'),
        weapon('Spear'),
        meals('5 Special Rations', 5),
        weapon('Mace'),
        special('Chainmail Waistcoat'),
        special('Shield'),
      ],
    },
  },
  '05sots': {
    fixed: [{ slot: 'specialItems', name: 'Map of Vassagonia' }],
    goldBase: 10,
    pick: {
      mode: 'choose',
      count: 4,
      options: [
        weapon('Dagger'),
        backpack('Potion of Laumspur'),
        weapon('Sword'),
        weapon('Spear'),
        meals('2 Special Rations', 2),
        weapon('Mace'),
        special('Shield'),
      ],
    },
  },
};

export function startingEquipmentFor(bookId: string): StartingEquipment | null {
  return STARTING_EQUIPMENT[bookId] ?? null;
}

// ---------------------------------------------------------------------------
// Inventaire
// ---------------------------------------------------------------------------

export type InventoryError = 'weaponsFull' | 'backpackFull';

/** Les Repas comptent dans la capacité du sac à dos. */
export function backpackLoad(character: Character): number {
  return character.backpack.length + character.meals;
}

export function addItem(
  character: Character,
  slot: ItemSlot,
  name: string,
  rules: SeriesRules,
): { character: Character; error?: InventoryError } {
  const item = name.trim();
  if (!item) return { character };
  if (slot === 'weapons' && character.weapons.length >= rules.maxWeapons) {
    return { character, error: 'weaponsFull' };
  }
  if (slot === 'backpack' && backpackLoad(character) >= rules.maxBackpackItems) {
    return { character, error: 'backpackFull' };
  }
  const next = { ...character, [slot]: [...character[slot], item] };
  return { character: applyEnduranceBonus(next, item, +1) };
}

export function removeItem(character: Character, slot: ItemSlot, index: number): Character {
  const item = character[slot][index];
  if (item === undefined) return character;
  const next = { ...character, [slot]: character[slot].filter((_, i) => i !== index) };
  return applyEnduranceBonus(next, item, -1);
}

export function addMeals(
  character: Character,
  count: number,
  rules: SeriesRules,
): { character: Character; error?: InventoryError } {
  const room = rules.maxBackpackItems - backpackLoad(character);
  if (count > room) return { character, error: 'backpackFull' };
  return { character: { ...character, meals: Math.max(0, character.meals + count) } };
}

export function addGold(character: Character, amount: number, rules: SeriesRules): Character {
  return { ...character, gold: Math.min(rules.maxGold, Math.max(0, character.gold + amount)) };
}

/** Boit une potion du sac à dos : rend de l'ENDURANCE sans dépasser le total. */
export function useItem(character: Character, index: number): Character {
  const heal = itemEffect(character.backpack[index] ?? '')?.heal;
  if (!heal) return character;
  return {
    ...character,
    backpack: character.backpack.filter((_, i) => i !== index),
    endurance: Math.min(character.enduranceMax, character.endurance + heal),
  };
}

/** Bonus d'HABILETÉ des objets spéciaux portés (ex. Shield). */
export function itemsCombatBonus(character: Character): number {
  return character.specialItems.reduce(
    (sum, item) => sum + (itemEffect(item)?.combatSkill ?? 0),
    0,
  );
}

export function applyGrants(
  character: Character,
  grants: readonly Grant[],
  rules: SeriesRules,
): { character: Character; errors: InventoryError[] } {
  const errors: InventoryError[] = [];
  let current = character;
  for (const grant of grants) {
    if (grant.slot === 'gold') {
      current = addGold(current, grant.amount, rules);
      continue;
    }
    const result =
      grant.slot === 'meals'
        ? addMeals(current, grant.count, rules)
        : addItem(current, grant.slot, grant.name, rules);
    current = result.character;
    if (result.error) errors.push(result.error);
  }
  return { character: current, errors };
}

/** Nombre d'armes qu'apporterait une sélection d'options (pour bloquer un choix impossible). */
export function weaponCount(options: readonly EquipmentOption[]): number {
  return options.reduce((n, o) => n + o.grants.filter((g) => g.slot === 'weapons').length, 0);
}

function applyEnduranceBonus(character: Character, item: string, sign: 1 | -1): Character {
  const bonus = itemEffect(item)?.endurance;
  if (!bonus) return character;
  const enduranceMax = Math.max(1, character.enduranceMax + sign * bonus);
  const endurance = Math.max(0, Math.min(enduranceMax, character.endurance + sign * bonus));
  return { ...character, enduranceMax, endurance };
}

// ---------------------------------------------------------------------------
// Repas
// ---------------------------------------------------------------------------

export type MealChoice = 'meal' | 'hunting' | 'starve';

/** Résout une obligation de manger : Repas consommé, Chasse, ou −3 ENDURANCE. */
export function resolveMeal(character: Character, choice: MealChoice): Character {
  switch (choice) {
    case 'meal':
      return character.meals > 0 ? { ...character, meals: character.meals - 1 } : character;
    case 'hunting':
      return character;
    case 'starve':
      return { ...character, endurance: Math.max(0, character.endurance - 3) };
  }
}

/** La section impose-t-elle de manger ? (« you must eat a Meal or lose 3 ENDURANCE ») */
export function requiresMeal(text: string): boolean {
  return /\bmust\b[^.]{0,60}\beat a Meal\b/i.test(text);
}
