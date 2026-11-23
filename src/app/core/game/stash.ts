import { Character, Stash } from './game.models';

/** Réserve concernée : « mis de côté » (temporaire, ex. confiscation) ou coffre du monastère Kai (entre deux aventures). */
export type StashField = 'stash' | 'monastery';
import { InventoryError, addGold, addItem, backpackLoad } from './equipment';
import { SeriesRules } from './rules';

/** Emplacements d'objets pouvant être mis de côté. */
export type StashSlot = 'weapons' | 'backpack' | 'specialItems';

/** Ce qu'on met de côté : positions des objets, et or / Repas en bloc. */
export interface StashPick {
  weapons: number[];
  backpack: number[];
  specialItems: number[];
  gold: boolean;
  meals: boolean;
}

const SLOTS: StashSlot[] = ['weapons', 'backpack', 'specialItems'];

export function emptyStash(): Stash {
  return { weapons: [], backpack: [], specialItems: [], gold: 0, meals: 0 };
}

/** Nombre d'entrées mises de côté (chaque objet, plus l'or et les Repas s'il y en a). */
export function stashCount(stash: Stash | undefined): number {
  if (!stash) return 0;
  return (
    stash.weapons.length +
    stash.backpack.length +
    stash.specialItems.length +
    (stash.gold > 0 ? 1 : 0) +
    (stash.meals > 0 ? 1 : 0)
  );
}

/** Ajoute à une réserve de l'or et des objets (surplus mis de côté, armes laissées au monastère…). */
export function addToStash(
  c: Character,
  field: StashField,
  extra: { gold?: number; weapons?: readonly string[]; specialItems?: readonly string[] },
): Character {
  const stash = { ...emptyStash(), ...c[field] };
  stash.gold += extra.gold ?? 0;
  stash.weapons = [...stash.weapons, ...(extra.weapons ?? [])];
  stash.specialItems = [...stash.specialItems, ...(extra.specialItems ?? [])];
  return stashCount(stash) ? { ...c, [field]: stash } : c;
}

/** Sélection de tout ce que porte le personnage. */
export function pickAll(c: Character): StashPick {
  const all = (list: string[]) => list.map((_, i) => i);
  return {
    weapons: all(c.weapons),
    backpack: all(c.backpack),
    specialItems: all(c.specialItems),
    gold: c.gold > 0,
    meals: c.meals > 0,
  };
}

/** Retire de l'inventaire les éléments choisis et les ajoute à la réserve « mis de côté ». */
export function putAside(c: Character, pick: StashPick, field: StashField = 'stash'): Character {
  const stash = { ...emptyStash(), ...c[field] };
  const next: Character = { ...c };
  for (const slot of SLOTS) {
    const chosen = new Set(pick[slot]);
    stash[slot] = [...stash[slot], ...c[slot].filter((_, i) => chosen.has(i))];
    next[slot] = c[slot].filter((_, i) => !chosen.has(i));
  }
  if (pick.gold) {
    stash.gold += c.gold;
    next.gold = 0;
  }
  if (pick.meals) {
    stash.meals += c.meals;
    next.meals = 0;
  }
  return { ...next, [field]: stash };
}

export type StashTarget = { slot: StashSlot; index: number } | 'gold' | 'meals';

function withoutTarget(stash: Stash, target: StashTarget): Stash {
  if (target === 'gold') return { ...stash, gold: 0 };
  if (target === 'meals') return { ...stash, meals: 0 };
  return { ...stash, [target.slot]: stash[target.slot].filter((_, i) => i !== target.index) };
}

function normalized(c: Character, stash: Stash, field: StashField): Character {
  return stashCount(stash) ? { ...c, [field]: stash } : { ...c, [field]: undefined };
}

/**
 * Récupère un élément mis de côté. Un objet qui ne rentre pas reste de côté (erreur renvoyée) ; l'or et
 * les Repas reviennent autant que la place le permet, le reste demeure de côté.
 */
export function getBack(
  c: Character,
  rules: SeriesRules,
  target: StashTarget,
  field: StashField = 'stash',
): { character: Character; error?: InventoryError } {
  const stash = { ...emptyStash(), ...c[field] };
  if (target === 'gold') {
    const room = Math.max(0, rules.maxGold - c.gold);
    const back = Math.min(room, stash.gold);
    return {
      character: normalized(addGold(c, back, rules), { ...stash, gold: stash.gold - back }, field),
    };
  }
  if (target === 'meals') {
    const room = Math.max(0, rules.maxBackpackItems - backpackLoad(c));
    const back = Math.min(room, stash.meals);
    return {
      character: normalized(
        { ...c, meals: c.meals + back },
        { ...stash, meals: stash.meals - back },
        field,
      ),
      error: back < stash.meals ? 'backpackFull' : undefined,
    };
  }
  const name = stash[target.slot][target.index];
  if (name === undefined) return { character: c };
  const result = addItem(c, target.slot, name, rules);
  if (result.error) return { character: c, error: result.error };
  return { character: normalized(result.character, withoutTarget(stash, target), field) };
}

/** Abandonne définitivement un élément mis de côté. */
export function discard(c: Character, target: StashTarget, field: StashField = 'stash'): Character {
  return normalized(c, withoutTarget({ ...emptyStash(), ...c[field] }, target), field);
}
