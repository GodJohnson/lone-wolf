import { combatResult, ratioColumn } from './combat-results-table';

describe('combat-results-table', () => {
  it.each([
    [-15, 0],
    [-11, 0],
    [-10, 1],
    [-9, 1],
    [-8, 2],
    [-3, 4],
    [-2, 5],
    [-1, 5],
    [0, 6],
    [1, 7],
    [2, 7],
    [3, 8],
    [6, 9],
    [9, 11],
    [10, 11],
    [11, 12],
    [30, 12],
  ])('ratio %i → colonne %i', (ratio, column) => {
    expect(ratioColumn(ratio)).toBe(column);
  });

  it('lit les cellules de la table', () => {
    expect(combatResult(-11, 1)).toEqual({ enemyLoss: 0, playerLoss: 'K' });
    expect(combatResult(0, 1)).toEqual({ enemyLoss: 3, playerLoss: 5 });
    expect(combatResult(0, 0)).toEqual({ enemyLoss: 12, playerLoss: 0 });
    expect(combatResult(-1, 5)).toEqual({ enemyLoss: 6, playerLoss: 3 });
    expect(combatResult(4, 6)).toEqual({ enemyLoss: 10, playerLoss: 2 });
    expect(combatResult(11, 8)).toEqual({ enemyLoss: 'K', playerLoss: 0 });
  });

  it('refuse un tirage hors 0-9', () => {
    expect(() => combatResult(0, 10)).toThrow(RangeError);
  });
});
