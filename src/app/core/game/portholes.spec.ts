import { portholesRound } from './portholes';

describe('portholes', () => {
  it('gagne 6 si le total dépasse celui des deux autres joueurs', () => {
    expect(portholesRound([9, 8], [3, 4], [5, 2])).toMatchObject({
      outcome: 'win',
      net: 6,
      totals: { you: 17, others: [7, 7] },
    });
  });

  it('perd 3 si l’un des deux autres bat le score', () => {
    expect(portholesRound([4, 4], [9, 9], [1, 1])).toMatchObject({ outcome: 'lose', net: -3 });
    expect(portholesRound([4, 4], [1, 1], [5, 4])).toMatchObject({ outcome: 'lose', net: -3 });
  });

  it('égalité avec le meilleur adversaire : ni gain ni perte', () => {
    expect(portholesRound([5, 5], [2, 8], [1, 1])).toMatchObject({ outcome: 'tie', net: 0 });
    expect(portholesRound([6, 6], [6, 6], [1, 2])).toMatchObject({ outcome: 'tie', net: 0 });
  });

  it('deux 0 (portholes) : victoire automatique', () => {
    expect(portholesRound([0, 0], [9, 9], [9, 9])).toMatchObject({
      outcome: 'win',
      net: 6,
      portholes: 'you',
    });
    expect(portholesRound([0, 0], [0, 0], [1, 1])).toMatchObject({
      outcome: 'win',
      portholes: 'you',
    });
  });

  it('portholes d’un autre joueur : vous perdez, même avec un bon score', () => {
    expect(portholesRound([9, 9], [0, 0], [1, 1])).toMatchObject({
      outcome: 'lose',
      net: -3,
      portholes: 'other',
    });
  });

  it('refuse un dé hors 0-9', () => {
    expect(() => portholesRound([10, 0], [1, 1], [1, 1])).toThrow(RangeError);
  });
});
