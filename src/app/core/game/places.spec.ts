import { BOOK_MAPS, findPlace, knownPlaceNames, parsePin } from './places';

describe('places', () => {
  it('place un lieu connu en fractions de la carte, sans tenir compte de la casse', () => {
    const p = findPlace('02fotw', 'holmgard')!;
    expect(p.x).toBeCloseTo(225 / 1024);
    expect(p.y).toBeCloseTo(503 / 793);
  });
  it('connaît les graphies alternatives et ignore les lieux inconnus', () => {
    expect(findPlace('02fotw', 'Wild Lands')).toEqual(findPlace('02fotw', 'Wildlands'));
    expect(findPlace('02fotw', 'Atlantis')).toBeNull();
    expect(knownPlaceNames('inconnu')).toEqual([]);
  });
  it('l’épingle du joueur l’emporte sur la position du livre', () => {
    expect(findPlace('02fotw', 'Holmgard', ['Holmgard|0.5|0.25'])).toEqual({ x: 0.5, y: 0.25 });
    expect(findPlace('02fotw', 'Atlantis', ['Atlantis|0.1|0.9'])).toEqual({ x: 0.1, y: 0.9 });
  });
  it('rejette une épingle mal formée', () => {
    expect(parsePin('X|2|0.5')).toBeNull();
    expect(parsePin('|0.1|0.1')).toBeNull();
  });
  it('toutes les positions tiennent dans l’image', () => {
    for (const map of Object.values(BOOK_MAPS))
      for (const p of map.places) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(map.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(map.height);
      }
  });
});
