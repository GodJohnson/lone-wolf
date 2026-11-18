import { Enemy, Series } from '../book/book.models';
import { combatResult } from './combat-results-table';
import { itemsCombatBonus } from './equipment';
import { Character, CombatRound, CombatState } from './game.models';

export interface SeriesRules {
  disciplinesToChoose: number;
  combatSkillBase: number;
  enduranceBase: number;
  maxWeapons: number;
  maxBackpackItems: number;
  maxGold: number;
  /**
   * Règles vérifiées sur le texte des livres. Les autres sont des valeurs par défaut à confirmer :
   * le joueur peut tout corriger sur sa Feuille d'aventure.
   */
  verified: boolean;
}

export const SERIES_RULES: Record<Series, SeriesRules> = {
  kai: {
    disciplinesToChoose: 5,
    combatSkillBase: 10,
    enduranceBase: 20,
    maxWeapons: 2,
    maxBackpackItems: 8,
    maxGold: 50,
    verified: true,
  },
  magnakai: {
    disciplinesToChoose: 3,
    combatSkillBase: 10,
    enduranceBase: 20,
    maxWeapons: 2,
    maxBackpackItems: 8,
    maxGold: 50,
    verified: false,
  },
  grandmaster: {
    disciplinesToChoose: 4,
    combatSkillBase: 25,
    enduranceBase: 30,
    maxWeapons: 2,
    maxBackpackItems: 10,
    maxGold: 50,
    verified: false,
  },
  neworder: {
    disciplinesToChoose: 4,
    combatSkillBase: 25,
    enduranceBase: 30,
    maxWeapons: 2,
    maxBackpackItems: 10,
    maxGold: 50,
    verified: false,
  },
};

export function rulesFor(series: Series | null): SeriesRules {
  return SERIES_RULES[series ?? 'kai'];
}

/** Table Weaponskill du livre 1 (`weapons.png`) : tirage 0-9 → arme. */
export const KAI_WEAPONSKILL_TABLE = [
  'Dagger',
  'Spear',
  'Mace',
  'Short Sword',
  'Warhammer',
  'Sword',
  'Axe',
  'Sword',
  'Quarterstaff',
  'Broadsword',
] as const;

/** Disciplines Kaï dont l'application gère l'effet automatiquement (noms anglais du livre). */
export const DISCIPLINE = {
  weaponskill: 'Weaponskill',
  mindblast: 'Mindblast',
  healing: 'Healing',
  hunting: 'Hunting',
} as const;

export function hasDiscipline(character: Character, name: string): boolean {
  return character.disciplines.some((d) => d.toLowerCase() === name.toLowerCase());
}

/**
 * L'arme profite-t-elle de Weaponskill (+2 HAB) ? Correspondance exacte, ou variante nommée d'après
 * le même type d'arme (« Giak Spear » pour Spear), mais pas un autre type de la table
 * (« Short Sword » n'est pas un Sword).
 */
export function isSkilledWeapon(character: Character, weapon: string): boolean {
  const skill = character.weaponskill?.trim().toLowerCase();
  if (!skill || !hasDiscipline(character, DISCIPLINE.weaponskill)) return false;
  const name = weapon.trim().toLowerCase();
  if (name === skill) return true;
  const otherTableWeapon = KAI_WEAPONSKILL_TABLE.some((t) => t.toLowerCase() === name);
  return name.endsWith(' ' + skill) && !otherTableWeapon;
}

export function newCharacter(series: Series | null, csRoll: number, epRoll: number): Character {
  const rules = rulesFor(series);
  const endurance = rules.enduranceBase + epRoll;
  return {
    combatSkill: rules.combatSkillBase + csRoll,
    endurance,
    enduranceMax: endurance,
    disciplines: [],
    weaponskill: null,
    weapons: [],
    backpack: [],
    specialItems: [],
    gold: 0,
    meals: 0,
    notes: '',
  };
}

export interface CombatSkillBreakdown {
  base: number;
  weaponskill: number;
  noWeapon: number;
  mindblast: number;
  /** Objets spéciaux (ex. Shield +2). */
  items: number;
  modifier: number;
  total: number;
}

/** Un objet spécial qui est une arme (« Magic Spear ») : il sert en combat comme une arme portée. */
const WEAPON_LIKE = /\b(?:spear|sword|broadsword|axe|mace|dagger|warhammer|quarterstaff|bow)$/i;

/** Armes utilisables en combat : armes portées et objets spéciaux qui en sont (voir `WEAPON_LIKE`). */
export function combatWeapons(character: Character): string[] {
  return [
    ...character.weapons,
    ...character.specialItems.filter((i) => WEAPON_LIKE.test(i.trim())),
  ];
}

export function effectiveCombatSkill(
  character: Character,
  combat: Pick<CombatState, 'modifier' | 'useMindblast'>,
): CombatSkillBreakdown {
  const weapons = combatWeapons(character);
  const weaponskill = weapons.some((w) => isSkilledWeapon(character, w)) ? 2 : 0;
  const noWeapon = weapons.length === 0 ? -4 : 0;
  const mindblast = combat.useMindblast && hasDiscipline(character, DISCIPLINE.mindblast) ? 2 : 0;
  const items = itemsCombatBonus(character);
  const base = character.combatSkill;
  return {
    base,
    weaponskill,
    noWeapon,
    mindblast,
    items,
    modifier: combat.modifier,
    total: base + weaponskill + noWeapon + mindblast + items + combat.modifier,
  };
}

export function startCombat(
  section: number,
  blockIndex: number,
  enemy: Enemy,
  character: Character,
): CombatState {
  return {
    section,
    blockIndex,
    enemy,
    enemyEndurance: enemy.endurance,
    modifier: 0,
    useMindblast: hasDiscipline(character, DISCIPLINE.mindblast),
    rounds: [],
    outcome: 'ongoing',
  };
}

/**
 * Joue un assaut. En cas de fuite (`evade`), seules les pertes de Loup Solitaire sont appliquées
 * et le combat se termine.
 */
export function playRound(
  combat: CombatState,
  character: Character,
  roll: number,
  evade = false,
): { combat: CombatState; character: Character } {
  if (combat.outcome !== 'ongoing') return { combat, character };

  const ratio = effectiveCombatSkill(character, combat).total - combat.enemy.combatSkill;
  const { enemyLoss, playerLoss } = combatResult(ratio, roll);

  const enemyEndurance = evade
    ? combat.enemyEndurance
    : applyLoss(combat.enemyEndurance, enemyLoss);
  const playerEndurance = applyLoss(character.endurance, playerLoss);

  const round: CombatRound = {
    roll,
    ratio,
    enemyLoss: evade ? 0 : enemyLoss,
    playerLoss,
    enemyEndurance,
    playerEndurance,
    evaded: evade,
  };

  const outcome: CombatState['outcome'] =
    playerEndurance <= 0 ? 'lost' : evade ? 'evaded' : enemyEndurance <= 0 ? 'won' : 'ongoing';

  return {
    combat: { ...combat, enemyEndurance, rounds: [...combat.rounds, round], outcome },
    character: { ...character, endurance: playerEndurance },
  };
}

function applyLoss(endurance: number, loss: number | 'K'): number {
  return loss === 'K' ? 0 : Math.max(0, endurance - loss);
}

/**
 * Guérison (Kaï) : +1 ENDURANCE pour chaque section quittée sans y avoir combattu,
 * sans dépasser le total initial.
 */
export function healingOnLeave(
  character: Character,
  leftSection: number,
  foughtIn: readonly number[],
): Character {
  if (!hasDiscipline(character, DISCIPLINE.healing)) return character;
  if (foughtIn.includes(leftSection) || character.endurance <= 0) return character;
  if (character.endurance >= character.enduranceMax) return character;
  return { ...character, endurance: character.endurance + 1 };
}
