import { MapDef, Owner, TowerSpec, WORLD } from './tower-war.models';

type Entry = [x: number, y: number, garrison: number];

/**
 * Construit une carte à symétrie centrale : le côté du joueur (bas) est défini, celui de l'IA
 * en est le miroir exact, ce qui garantit l'équité. Les tours neutres sont listées par paire.
 */
function symmetric(id: string, starts: Entry[], neutrals: Entry[]): MapDef {
  const mirror = (e: Entry): Entry => [WORLD.width - e[0], WORLD.height - e[1], e[2]];
  const spec =
    (owner: Owner) =>
    (e: Entry): TowerSpec => ({
      x: e[0],
      y: e[1],
      garrison: e[2],
      owner,
    });
  return {
    id,
    towers: [
      ...starts.map(spec('player')),
      ...starts.map(mirror).map(spec('ai')),
      ...neutrals.map(spec('neutral')),
      ...neutrals.map(mirror).map(spec('neutral')),
    ],
  };
}

/**
 * Les coordonnées ont été cherchées pour qu'aucune tour ne masque une liaison de moins de 60
 * entre deux autres (vérifié par les tests) : les unités survolent les tours, mais le joueur doit
 * pouvoir lire à quelle tour mène chaque lien.
 */
export const MAPS: readonly MapDef[] = [
  symmetric(
    'skirmish',
    [[50, 134, 10]],
    [
      [57, 115, 6],
      [17, 112, 8],
      [84, 65, 12],
    ],
  ),
  symmetric(
    'crossroads',
    [
      [26, 134, 10],
      [74, 133, 10],
    ],
    [
      [50, 115, 6],
      [18, 99, 8],
      [43, 66, 12],
      [84, 92, 8],
    ],
  ),
  symmetric(
    'archipelago',
    [[50, 138, 10]],
    [
      [33, 128, 5],
      [75, 127, 5],
      [61, 111, 7],
      [17, 97, 9],
      [57, 84, 11],
      [81, 83, 11],
    ],
  ),
];
