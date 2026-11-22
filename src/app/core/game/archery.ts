import { combatResult } from './combat-results-table';

/**
 * Tournoi d'archerie du livre 6 (Project Aon : sections 340 et 26). Règles du texte :
 *  - Qualification (§340) : trois nombres tirés dans la Table de hasard, additionnés ; +3 avec la Discipline
 *    Weaponmastery avec Bow. 7 ou moins : éliminé (103) ; 8 ou plus : qualifié pour la finale (26).
 *  - Finale (§26) : combat normal contre Altan (HABILETÉ 28), mais avec 50 points de CIBLE de part et d'autre :
 *    les pertes d'ENDURANCE s'y déduisent (l'ENDURANCE réelle ne change pas). Le premier à zéro perd :
 *    vous → 183, Altan → 252. Aucune flèche n'est effacée.
 *  - Jakan (arc fendu, §298) : −2 HAB pour le tournoi, et un 0 tiré brise l'arc (§335 en finale).
 */
export const ARCHERY = {
  book: '06tkot',
  qualification: 340,
  final: 26,
  eliminated: 103,
  finalLost: 183,
  finalWon: 252,
  jakanBroke: 335,
  targetPoints: 50,
  altanCombatSkill: 28,
  qualifyingScore: 8,
  bowMasteryBonus: 3,
  jakanPenalty: 2,
} as const;

export interface Qualification {
  picks: number[];
  /** Somme des tirages, avant bonus. */
  sum: number;
  bonus: number;
  total: number;
  qualified: boolean;
  /** Un 0 tiré avec le Jakan le brise. */
  jakanBroke: boolean;
}

export function qualification(
  picks: readonly number[],
  bowMastery: boolean,
  jakan = false,
): Qualification {
  if (picks.length !== 3 || picks.some((n) => !Number.isInteger(n) || n < 0 || n > 9))
    throw new RangeError('picks');
  const sum = picks.reduce((a, b) => a + b, 0);
  const bonus = bowMastery ? ARCHERY.bowMasteryBonus : 0;
  const total = sum + bonus;
  return {
    picks: [...picks],
    sum,
    bonus,
    total,
    qualified: total >= ARCHERY.qualifyingScore,
    jakanBroke: jakan && picks.includes(0),
  };
}

export interface FinalState {
  player: number;
  enemy: number;
}

export interface FinalRound {
  roll: number;
  ratio: number;
  playerLoss: number;
  enemyLoss: number;
  /** Le Jakan s'est brisé (0 tiré) : défaite immédiate. */
  jakanBroke: boolean;
  state: FinalState;
  outcome: 'ongoing' | 'won' | 'lost' | 'broken';
}

export const FINAL_START: FinalState = {
  player: ARCHERY.targetPoints,
  enemy: ARCHERY.targetPoints,
};

/** Un assaut de la finale : table de combat habituelle, pertes retirées des points de CIBLE. */
export function finalRound(
  state: FinalState,
  playerCombatSkill: number,
  roll: number,
  jakan = false,
): FinalRound {
  const ratio = playerCombatSkill - ARCHERY.altanCombatSkill;
  if (jakan && roll === 0) {
    return { roll, ratio, playerLoss: 0, enemyLoss: 0, jakanBroke: true, state, outcome: 'broken' };
  }
  const result = combatResult(ratio, roll);
  // « K » (tué) : tous les points de cible restants sont perdus.
  const loss = (l: number | 'K', pool: number) => (l === 'K' ? pool : l);
  const playerLoss = loss(result.playerLoss, state.player);
  const enemyLoss = loss(result.enemyLoss, state.enemy);
  const next = {
    player: Math.max(0, state.player - playerLoss),
    enemy: Math.max(0, state.enemy - enemyLoss),
  };
  // Les deux à zéro dans le même assaut : le premier à tout perdre est celui qui perd le plus (égalité : Altan).
  const outcome =
    next.player === 0 && next.enemy === 0
      ? playerLoss > enemyLoss
        ? 'lost'
        : 'won'
      : next.player === 0
        ? 'lost'
        : next.enemy === 0
          ? 'won'
          : 'ongoing';
  return { roll, ratio, playerLoss, enemyLoss, jakanBroke: false, state: next, outcome };
}
