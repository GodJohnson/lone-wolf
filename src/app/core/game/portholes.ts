/**
 * Portholes, jeu de dés des marins (livre 2, section 308). Règles du texte : chaque joueur lance
 * deux dés à dix faces (0-9) et additionne ; deux 0 (« portholes ») font gagner automatiquement.
 * Mise de 3 couronnes par lancer, deux autres joueurs. Si votre total dépasse celui des deux autres,
 * vous gagnez 6 couronnes ; si l'un d'eux bat votre score, vous perdez 3.
 */
export const PORTHOLES = { book: '02fotw', section: 308, exit: 197, stake: 3, win: 6 } as const;

export type PortholesOutcome = 'win' | 'lose' | 'tie';
export type Dice = readonly [number, number];

export interface PortholesRound {
  outcome: PortholesOutcome;
  /** Variation d'or : +6, −3 ou 0. */
  net: number;
  totals: { you: number; others: [number, number] };
  /** Joueur ayant fait « portholes » (deux 0), le cas échéant. */
  portholes: 'you' | 'other' | null;
}

const total = (d: Dice) => d[0] + d[1];
const isPortholes = (d: Dice) => d[0] === 0 && d[1] === 0;

export function portholesRound(you: Dice, other1: Dice, other2: Dice): PortholesRound {
  for (const die of [...you, ...other1, ...other2]) {
    if (!Number.isInteger(die) || die < 0 || die > 9) throw new RangeError('die');
  }
  const totals = { you: total(you), others: [total(other1), total(other2)] as [number, number] };
  let outcome: PortholesOutcome;
  let portholes: PortholesRound['portholes'] = null;

  if (isPortholes(you)) {
    // Deux 0 pour vous : victoire automatique, même si un autre joueur fait aussi « portholes ».
    outcome = 'win';
    portholes = 'you';
  } else if (isPortholes(other1) || isPortholes(other2)) {
    outcome = 'lose';
    portholes = 'other';
  } else {
    const best = Math.max(...totals.others);
    outcome = totals.you > best ? 'win' : best > totals.you ? 'lose' : 'tie';
  }
  return {
    outcome,
    net: outcome === 'win' ? PORTHOLES.win : outcome === 'lose' ? -PORTHOLES.stake : 0,
    totals,
    portholes,
  };
}
