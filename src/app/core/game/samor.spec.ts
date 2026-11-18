import { samorResult } from './samor';

describe('samorResult', () => {
  it('applique les tranches du texte', () => {
    expect(samorResult(3, false)).toEqual({ score: 3, target: 58, net: -10 });
    expect(samorResult(4, false)).toEqual({ score: 4, target: 167, net: 0 });
    expect(samorResult(6, false)).toEqual({ score: 6, target: 167, net: 0 });
    expect(samorResult(7, false)).toEqual({ score: 7, target: 329, net: 10 });
  });
  it('ajoute 2 avec Sixth Sense (jusqu’à 11)', () => {
    expect(samorResult(1, true).target).toBe(58);
    expect(samorResult(2, true).target).toBe(167);
    expect(samorResult(9, true)).toEqual({ score: 11, target: 329, net: 10 });
  });
  it('refuse un tirage hors Table de hasard', () => {
    expect(() => samorResult(10, false)).toThrow();
  });
});
