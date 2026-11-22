import { Character } from './game.models';
import { bowShotBonus, hasSilverBow } from './bow';
import { newCharacter } from './rules';

const hero = (over: Partial<Character> = {}): Character => ({
  ...newCharacter('magnakai', 5, 5),
  disciplines: [],
  ...over,
});

describe('bow', () => {
  it('Weaponmastery avec Bow : +3, seulement si Bow est une arme maîtrisée', () => {
    const mastered = hero({ disciplines: ['Weaponmastery'], weaponmastery: ['Bow'] });
    expect(bowShotBonus(mastered)).toEqual({ mastery: 3, silverBow: 0, total: 3 });
    expect(
      bowShotBonus(hero({ disciplines: ['Weaponmastery'], weaponmastery: ['Sword'] })).total,
    ).toBe(0);
    expect(bowShotBonus(hero()).total).toBe(0);
  });

  it('Silver Bow of Duadon : +3, qui se cumule avec Weaponmastery (6 au total)', () => {
    const silver = hero({ specialItems: ['Silver Bow of Duadon'] });
    expect(bowShotBonus(silver)).toEqual({ mastery: 0, silverBow: 3, total: 3 });
    const both = hero({
      disciplines: ['Weaponmastery'],
      weaponmastery: ['Bow'],
      specialItems: ['Silver Bow of Duadon'],
    });
    expect(bowShotBonus(both)).toEqual({ mastery: 3, silverBow: 3, total: 6 });
  });

  it('reconnaît les graphies du prix (« silver oak bow »)', () => {
    expect(hasSilverBow(hero({ specialItems: ['Silver Oaken Bow'] }))).toBe(true);
    expect(hasSilverBow(hero({ specialItems: ['silver oak bow'] }))).toBe(true);
    expect(hasSilverBow(hero({ specialItems: ['Silver Helm'] }))).toBe(false);
  });
});
