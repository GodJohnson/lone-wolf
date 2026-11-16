/**
 * Table des résultats de combat (Combat Results Table), commune à tous les livres.
 *
 * Dette technique assumée : la table n'est fournie dans le zip que sous forme d'image
 * (`crtneg.png` / `crtpos.png`), elle est donc retranscrite ici. Il s'agit d'une donnée
 * de mécanique de jeu (des nombres), pas du texte des livres.
 *
 * Chaque cellule = [perte d'ENDURANCE de l'ennemi, perte de Loup Solitaire], 'K' = tué net.
 */
export type Loss = number | 'K';
type Cell = readonly [Loss, Loss];

const K = 'K' as const;

/** Colonnes : ≤-11, -10/-9, -8/-7, -6/-5, -4/-3, -2/-1, 0, +1/+2, +3/+4, +5/+6, +7/+8, +9/+10, ≥+11 */
// prettier-ignore
const TABLE: Record<number, readonly Cell[]> = {
  1: [[0, K], [0, K], [0, 8], [0, 6], [1, 6], [2, 5], [3, 5], [4, 5], [5, 4], [6, 4], [7, 4], [8, 3], [9, 3]],
  2: [[0, K], [0, 8], [0, 7], [1, 6], [2, 5], [3, 5], [4, 4], [5, 4], [6, 3], [7, 3], [8, 3], [9, 3], [10, 2]],
  3: [[0, 8], [0, 7], [1, 6], [2, 5], [3, 5], [4, 4], [5, 4], [6, 3], [7, 3], [8, 3], [9, 2], [10, 2], [11, 2]],
  4: [[0, 8], [1, 7], [2, 6], [3, 5], [4, 4], [5, 4], [6, 3], [7, 3], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2]],
  5: [[1, 7], [2, 6], [3, 5], [4, 4], [5, 4], [6, 3], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [14, 1]],
  6: [[2, 6], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [8, 2], [9, 2], [10, 2], [11, 1], [12, 1], [14, 1], [16, 1]],
  7: [[3, 5], [4, 5], [5, 4], [6, 3], [7, 2], [8, 2], [9, 1], [10, 1], [11, 1], [12, 0], [14, 0], [16, 0], [18, 0]],
  8: [[4, 4], [5, 4], [6, 3], [7, 2], [8, 1], [9, 1], [10, 0], [11, 0], [12, 0], [14, 0], [16, 0], [18, 0], [K, 0]],
  9: [[5, 3], [6, 3], [7, 2], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [14, 0], [16, 0], [18, 0], [K, 0], [K, 0]],
  0: [[6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [14, 0], [16, 0], [18, 0], [K, 0], [K, 0], [K, 0]],
};

export function ratioColumn(ratio: number): number {
  if (ratio <= -11) return 0;
  if (ratio >= 11) return 12;
  if (ratio === 0) return 6;
  // -10/-9 → 1 ... -2/-1 → 5 ; +1/+2 → 7 ... +9/+10 → 11
  return ratio < 0 ? 6 - Math.ceil(-ratio / 2) : 6 + Math.ceil(ratio / 2);
}

export function combatResult(ratio: number, roll: number): { enemyLoss: Loss; playerLoss: Loss } {
  if (!Number.isInteger(roll) || roll < 0 || roll > 9)
    throw new RangeError(`roll must be 0-9, got ${roll}`);
  const [enemyLoss, playerLoss] = TABLE[roll][ratioColumn(ratio)];
  return { enemyLoss, playerLoss };
}
