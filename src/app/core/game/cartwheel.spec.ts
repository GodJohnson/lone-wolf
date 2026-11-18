import { Character } from './game.models';
import {
  CARTWHEEL_CAP,
  SILVER_TOKEN,
  bankroll,
  cartwheelRound,
  loseStake,
  tokens,
} from './cartwheel';
import { newCharacter } from './rules';

const hero = (over: Partial<Character> = {}): Character => ({
  ...newCharacter('kai', 5, 5),
  ...over,
});

describe('cartwheel', () => {
  it('numéro exact : 8 couronnes par couronne misée', () => {
    expect(cartwheelRound(7, 3, 7, 0)).toEqual({ outcome: 'exact', net: 24, capped: false });
  });

  it('numéro voisin : 5 par couronne, des deux côtés', () => {
    expect(cartwheelRound(7, 2, 6, 0)).toMatchObject({ outcome: 'near', net: 10 });
    expect(cartwheelRound(7, 2, 8, 0)).toMatchObject({ outcome: 'near', net: 10 });
  });

  it('le 0 est entre le 9 et le 1 (la roue est circulaire)', () => {
    expect(cartwheelRound(9, 1, 0, 0)).toMatchObject({ outcome: 'near', net: 5 });
    expect(cartwheelRound(0, 1, 9, 0)).toMatchObject({ outcome: 'near', net: 5 });
    expect(cartwheelRound(1, 1, 0, 0)).toMatchObject({ outcome: 'near', net: 5 });
    expect(cartwheelRound(0, 1, 5, 0)).toMatchObject({ outcome: 'miss', net: -1 });
  });

  it('perdu : la mise est perdue', () => {
    expect(cartwheelRound(2, 4, 6, 0)).toEqual({ outcome: 'miss', net: -4, capped: false });
  });

  it('les gains sont plafonnés à 40 couronnes au total', () => {
    expect(cartwheelRound(5, 10, 5, 0)).toEqual({ outcome: 'exact', net: 40, capped: true });
    expect(cartwheelRound(5, 2, 5, 30)).toEqual({ outcome: 'exact', net: 10, capped: true });
    expect(cartwheelRound(5, 1, 5, 30)).toEqual({ outcome: 'exact', net: 8, capped: false });
    expect(cartwheelRound(5, 3, 5, CARTWHEEL_CAP).net).toBe(0);
  });

  it('refuse des valeurs hors limites', () => {
    expect(() => cartwheelRound(10, 1, 0, 0)).toThrow(RangeError);
    expect(() => cartwheelRound(1, 0, 0, 0)).toThrow(RangeError);
  });

  it('fonds : couronnes et jetons ; la mise perdue prend les couronnes d’abord', () => {
    const c = hero({ gold: 2, specialItems: ['Map', SILVER_TOKEN] });
    expect([tokens(c), bankroll(c)]).toEqual([1, 3]);
    const lost = loseStake(c, 3);
    expect(lost.gold).toBe(0);
    expect(lost.specialItems).toEqual(['Map']);
    expect(loseStake(c, 1)).toMatchObject({ gold: 1, specialItems: ['Map', SILVER_TOKEN] });
  });
});
