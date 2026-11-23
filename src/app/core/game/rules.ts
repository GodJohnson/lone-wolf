import { Enemy, Series } from '../book/book.models';
import { combatResult } from './combat-results-table';
import { buffsBonus } from './buffs';
import { itemsCombatBonus } from './equipment';
import { Character, CombatRound, CombatState } from './game.models';

/** Rangs Kaï (« Levels of Kai Training ») : un rang par Discipline maîtrisée, de 1 à 10. */
export const KAI_RANKS = [
  'Novice',
  'Intuite',
  'Doan',
  'Acolyte',
  'Initiate',
  'Aspirant',
  'Guardian',
  'Warmarn',
  'Savant',
  'Master',
] as const;

/** Rangs Magnakai (« Levels of Magnakai Training ») : un rang par Discipline Magnakai ; 3 au départ. */
export const MAGNAKAI_RANKS = [
  'Kai Master',
  'Kai Master Senior',
  'Kai Master Superior',
  'Primate',
  'Tutelary',
  'Principalin',
  'Mentora',
  'Scion-kai',
  'Archmaster',
  'Kai Grand Master',
] as const;

/** Liste des armes de Weaponmastery (« Weaponmastery Checklist » du livre 6). */
export const WEAPONMASTERY_WEAPONS = [
  'Dagger',
  'Spear',
  'Mace',
  'Short Sword',
  'Warhammer',
  'Bow',
  'Axe',
  'Sword',
  'Quarterstaff',
  'Broadsword',
] as const;

export interface SeriesRules {
  /** Les Cercles de Lore (bonus HAB/END des Disciplines Magnakai groupées) s'appliquent. */
  loreCircles?: boolean;
  /** Rangs de la série, du plus bas au plus haut (absent : rangs non gérés). */
  ranks?: readonly string[];
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
    ranks: KAI_RANKS,
  },
  magnakai: {
    disciplinesToChoose: 3,
    combatSkillBase: 10,
    enduranceBase: 20,
    maxWeapons: 2,
    maxBackpackItems: 8,
    maxGold: 50,
    verified: true,
    ranks: MAGNAKAI_RANKS,
    loreCircles: true,
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

/** Rang du personnage (index dans `rules.ranks`) : une Discipline de plus, un rang de plus. */
export function rankIndex(character: Character, rules: SeriesRules): number | null {
  const count = character.disciplines.length;
  return rules.ranks && count >= 1 ? Math.min(count, rules.ranks.length) - 1 : null;
}

export function rankName(character: Character, rules: SeriesRules): string | null {
  const index = rankIndex(character, rules);
  return index === null ? null : (rules.ranks?.[index] ?? null);
}

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
  // Disciplines Magnakai (livres 6 et suivants).
  weaponmastery: 'Weaponmastery',
  psisurge: 'Psi-surge',
  curing: 'Curing',
  huntmastery: 'Huntmastery',
  // Protections contre les attaques de Mindforce.
  mindshield: 'Mindshield',
  psiscreen: 'Psi-screen',
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
  const name = weapon.trim().toLowerCase();
  const skill = character.weaponskill?.trim().toLowerCase();
  if (skill && hasDiscipline(character, DISCIPLINE.weaponskill)) {
    return matchesSkill(skill, name);
  }
  // Weaponmastery (Magnakai) : une des armes cochées sur la liste.
  if (hasDiscipline(character, DISCIPLINE.weaponmastery)) {
    return (character.weaponmastery ?? []).some((w) => matchesSkill(w.trim().toLowerCase(), name));
  }
  return false;
}

/** L'arme (en minuscules) relève-t-elle de la maîtrise `skill` ? Exacte, ou variante du même type. */
function matchesSkill(skill: string, name: string): boolean {
  // Sommerswerd : se traite comme une épée à une main ; maîtrise de Short Sword, Sword ou Broadsword
  // lui donne le bonus de maîtrise (soit +10 au total avec ses +8 pour Weaponskill), sans cumul avec
  // une autre arme maîtrisée.
  if (name === 'sommerswerd') return ['short sword', 'sword', 'broadsword'].includes(skill);
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
  /** Psi-surge (Magnakai) : +4 HAB, mais −2 END par assaut. */
  psisurge: number;
  /** Objets spéciaux (ex. Shield +2). */
  items: number;
  /** Effets temporaires du combat (ex. Alether Berries +2). */
  buffs: number;
  modifier: number;
  total: number;
}

/** Un objet spécial qui est une arme (« Magic Spear ») : il sert en combat comme une arme portée. */
const WEAPON_LIKE =
  /\b(?:spear|sword|broadsword|axe|mace|dagger|warhammer|quarterstaff|bow|sommerswerd)$/i;

/** Armes utilisables en combat : armes portées et objets spéciaux qui en sont (voir `WEAPON_LIKE`). */
export function combatWeapons(character: Character): string[] {
  return [
    ...character.weapons,
    ...character.specialItems.filter((i) => WEAPON_LIKE.test(i.trim())),
  ];
}

/** Psi-surge actif : Discipline possédée, activé, et ENDURANCE au-dessus de 6 (sinon impossible). */
export function psiSurgeActive(character: Character, combat: { usePsiSurge?: boolean }): boolean {
  return (
    !!combat.usePsiSurge && hasDiscipline(character, DISCIPLINE.psisurge) && character.endurance > 6
  );
}

export function effectiveCombatSkill(
  character: Character,
  combat: Pick<CombatState, 'modifier' | 'useMindblast'> & {
    usePsiSurge?: boolean;
    buffs?: CombatState['buffs'];
  },
): CombatSkillBreakdown {
  const weapons = combatWeapons(character);
  // Maîtrise d'arme : +3 avec Weaponmastery (Magnakai), +2 avec Weaponskill (Kaï).
  const masteryBonus = hasDiscipline(character, DISCIPLINE.weaponmastery) ? 3 : 2;
  const weaponskill = weapons.some((w) => isSkilledWeapon(character, w)) ? masteryBonus : 0;
  const noWeapon = weapons.length === 0 ? -4 : 0;
  const psisurge = psiSurgeActive(character, combat) ? 4 : 0;
  const canMindblast =
    hasDiscipline(character, DISCIPLINE.mindblast) || hasDiscipline(character, DISCIPLINE.psisurge);
  // Psi-surge et Mindblast ne se cumulent pas : Psi-surge l'emporte.
  const mindblast = combat.useMindblast && canMindblast && !psisurge ? 2 : 0;
  const items = itemsCombatBonus(character);
  const buffs = buffsBonus(combat.buffs);
  const base = character.combatSkill;
  return {
    base,
    weaponskill,
    noWeapon,
    mindblast,
    psisurge,
    items,
    buffs,
    modifier: combat.modifier,
    total: base + weaponskill + noWeapon + mindblast + psisurge + items + buffs + combat.modifier,
  };
}

export function hasSommerswerd(character: Character): boolean {
  return character.specialItems.some((i) => i.trim().toLowerCase() === 'sommerswerd');
}

/** Mindshield (Kaï) et Psi-screen (Magnakai) annulent les pertes d'une attaque de Mindforce. */
export function mindforceProtected(character: Character): boolean {
  return (
    hasDiscipline(character, DISCIPLINE.mindshield) ||
    hasDiscipline(character, DISCIPLINE.psiscreen)
  );
}

export function startCombat(
  section: number,
  blockIndex: number,
  enemy: Enemy,
  character: Character,
  /** Perte d'END par assaut due à l'attaque de Mindforce de l'ennemi (0 : aucune). */
  mindforce = 0,
): CombatState {
  return {
    section,
    blockIndex,
    enemy,
    enemyEndurance: enemy.endurance,
    modifier: 0,
    // Une porte ou une cible n'est pas une créature : ni Mindblast ni Psi-surge.
    useMindblast:
      !enemy.pointsLabel &&
      hasDiscipline(character, DISCIPLINE.mindblast) &&
      !hasDiscipline(character, DISCIPLINE.psisurge),
    usePsiSurge:
      !enemy.pointsLabel &&
      hasDiscipline(character, DISCIPLINE.psisurge) &&
      character.endurance > 6,
    undead: /helghast/i.test(enemy.name),
    ...(mindforce ? { mindforce } : {}),
    // Les effets avalés avant le combat passent dans ce combat.
    ...(character.buffs?.length ? { buffs: [...character.buffs] } : {}),
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
  const result = combatResult(ratio, roll);
  // Psi-surge : 2 points d'ENDURANCE de plus perdus à chaque assaut où on l'utilise.
  const psiCost = psiSurgeActive(character, combat) ? 2 : 0;
  // Attaque de Mindforce : perte à chaque assaut, sauf Mindshield (Kaï) ou Psi-screen (Magnakai).
  const mindCost = combat.mindforce && !mindforceProtected(character) ? combat.mindforce : 0;
  const playerLoss =
    typeof result.playerLoss === 'number'
      ? result.playerLoss + psiCost + mindCost
      : result.playerLoss;
  // Sommerswerd : double les pertes d'ENDURANCE des morts-vivants (Helghast…).
  const doubled = combat.undead && hasSommerswerd(character);
  const enemyLoss =
    doubled && typeof result.enemyLoss === 'number' ? result.enemyLoss * 2 : result.enemyLoss;

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
  // Healing (Kaï) et Curing (Magnakai) : +1 END par section sans combat.
  if (!hasDiscipline(character, DISCIPLINE.healing) && !hasDiscipline(character, DISCIPLINE.curing))
    return character;
  if (foughtIn.includes(leftSection) || character.endurance <= 0) return character;
  if (character.endurance >= character.enduranceMax) return character;
  return { ...character, endurance: character.endurance + 1 };
}
