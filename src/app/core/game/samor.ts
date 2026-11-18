/**
 * Samor, jeu de plateau contre le capitaine Kelman (livre 2, section 12). Règles du texte : mise de
 * 10 couronnes ; on tire un nombre dans la Table de hasard, +2 avec la Discipline Sixth Sense ;
 * 0–3 : perdu (section 58), 4–6 : égalité (167), 7–11 : gagné (329).
 */
export const SAMOR = {
  book: '02fotw',
  section: 12,
  stake: 10,
  sixthSenseBonus: 2,
  lose: 58,
  draw: 167,
  win: 329,
} as const;

export interface SamorResult {
  score: number;
  target: number;
  /** Variation d'or : −mise, 0 ou +mise. */
  net: number;
}

export function samorResult(roll: number, sixthSense: boolean): SamorResult {
  if (!Number.isInteger(roll) || roll < 0 || roll > 9) throw new RangeError('roll');
  const score = roll + (sixthSense ? SAMOR.sixthSenseBonus : 0);
  if (score <= 3) return { score, target: SAMOR.lose, net: -SAMOR.stake };
  if (score <= 6) return { score, target: SAMOR.draw, net: 0 };
  return { score, target: SAMOR.win, net: SAMOR.stake };
}
