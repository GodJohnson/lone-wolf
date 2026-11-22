import { ARCHERY, FINAL_START, finalRound, qualification } from './archery';

describe('archery', () => {
  it('qualification : 8 ou plus passe, 7 ou moins est éliminé, +3 avec Weaponmastery avec Bow', () => {
    expect(qualification([3, 3, 1], false)).toMatchObject({ total: 7, qualified: false });
    expect(qualification([3, 3, 2], false)).toMatchObject({ total: 8, qualified: true });
    expect(qualification([3, 3, 1], true)).toMatchObject({
      sum: 7,
      bonus: 3,
      total: 10,
      qualified: true,
    });
    expect(() => qualification([1, 2], false)).toThrow();
    expect(() => qualification([1, 2, 10], false)).toThrow();
  });

  it('un 0 tiré avec le Jakan le brise, sans lui non', () => {
    expect(qualification([0, 5, 5], false, true).jakanBroke).toBe(true);
    expect(qualification([0, 5, 5], false, false).jakanBroke).toBe(false);
    expect(qualification([1, 5, 5], false, true).jakanBroke).toBe(false);
  });

  it('finale : les pertes viennent des points de cible, 50 de chaque côté', () => {
    const round = finalRound(FINAL_START, 28, 5);
    expect(round.state.player).toBe(ARCHERY.targetPoints - round.playerLoss);
    expect(round.state.enemy).toBe(ARCHERY.targetPoints - round.enemyLoss);
    expect(round.outcome).toBe('ongoing');
    expect(round.ratio).toBe(0);
  });

  it('finale : le premier à zéro perd, victoire quand Altan tombe à zéro', () => {
    expect(finalRound({ player: 50, enemy: 3 }, 40, 9).outcome).toBe('won');
    expect(finalRound({ player: 2, enemy: 50 }, 10, 1).outcome).toBe('lost');
  });

  it('finale avec le Jakan : un 0 le brise (défaite immédiate), les autres tirages comptent', () => {
    const broken = finalRound(FINAL_START, 26, 0, true);
    expect(broken).toMatchObject({ jakanBroke: true, outcome: 'broken' });
    expect(broken.state).toEqual(FINAL_START);
    expect(finalRound(FINAL_START, 26, 0, false).jakanBroke).toBe(false);
  });
});
