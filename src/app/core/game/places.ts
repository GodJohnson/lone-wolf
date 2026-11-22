/**
 * Lieux des cartes Project Aon : nom → position sur l'image `map.png` du livre (pixels de l'image
 * d'origine). Seuls des noms de lieux et des coordonnées sont stockés ici : la carte elle-même vient du
 * zip importé par le joueur. Les positions sont lues à l'œil sur les cartes ; le joueur peut les corriger
 * ou en ajouter (épingles, voir `findPlace`).
 */
export interface PlaceDef {
  name: string;
  x: number;
  y: number;
  /** Autres graphies rencontrées dans le texte. */
  aliases?: string[];
}

export interface BookMap {
  width: number;
  height: number;
  places: PlaceDef[];
}

const LASTLANDS: BookMap = {
  width: 1024,
  height: 793,
  places: [
    { name: 'Toran', x: 180, y: 388 },
    { name: 'Anskaven', x: 308, y: 338 },
    { name: 'Kai Monastery', x: 165, y: 452 },
    { name: 'Holmgard', x: 225, y: 503 },
    { name: 'Sommerlund', x: 240, y: 345 },
    { name: 'Ragadorn', x: 505, y: 556 },
    { name: 'Port Bax', x: 712, y: 558 },
    { name: 'Blave', x: 785, y: 620 },
    { name: 'Ryme', x: 757, y: 668 },
    { name: 'Lof', x: 797, y: 328 },
    { name: 'Verlin', x: 860, y: 637 },
    { name: 'Gorn Cove', x: 658, y: 602 },
    { name: 'Pass of Moytura', x: 230, y: 615 },
    { name: 'Durncrag Mountains', x: 90, y: 650 },
    { name: 'Wildlands', x: 450, y: 655, aliases: ['Wild Lands'] },
    { name: 'Durenor', x: 745, y: 430 },
    { name: 'Holmgulf', x: 285, y: 490 },
    { name: 'Gulf of Durenor', x: 565, y: 490 },
    { name: 'Kaltersee', x: 590, y: 235 },
    { name: 'Kirlundin Isles', x: 440, y: 330 },
    { name: 'Kirlundin Straits', x: 360, y: 365 },
    { name: 'Mannon', x: 405, y: 462 },
    { name: 'Wreck Point', x: 397, y: 482 },
    { name: 'Rymerift', x: 800, y: 722 },
  ],
};

const KALTE: BookMap = {
  width: 1024,
  height: 776,
  places: [
    { name: 'Ikaya', x: 432, y: 63, aliases: ['Ikaya the Ice Fortress'] },
    { name: 'Hrod Range', x: 190, y: 85 },
    { name: 'Storm Giant Pass', x: 330, y: 142 },
    { name: 'Viad Mountains', x: 345, y: 168 },
    { name: 'Viad Glacier', x: 432, y: 200 },
    { name: 'Myjavik Mountains', x: 560, y: 135 },
    { name: 'Hrod', x: 150, y: 145 },
    { name: 'Hrod Basin', x: 190, y: 195 },
    { name: 'Hrod Ice Shelf', x: 100, y: 155 },
    { name: 'Cloudmaker Mountain', x: 380, y: 212, aliases: ['Cloudmaker'] },
    { name: 'Kliu Range', x: 520, y: 212 },
    { name: 'Ljuk Range', x: 140, y: 255 },
    { name: 'Ljuk', x: 245, y: 283 },
    { name: 'Ljuk Ice Shelf', x: 330, y: 300 },
    { name: 'Ljuk Sound', x: 275, y: 347 },
    { name: 'The Rock', x: 300, y: 277 },
    { name: 'Gyem Island', x: 415, y: 286 },
    { name: 'Halle Bluff', x: 425, y: 340 },
    { name: 'Krie', x: 385, y: 368 },
    { name: 'Tola', x: 345, y: 380 },
    { name: 'Kliu Ice Shelf', x: 520, y: 318 },
    { name: 'Drigga Ice Shelf', x: 680, y: 235 },
    { name: 'Kaltersee', x: 140, y: 483 },
    { name: 'Anskaven', x: 115, y: 715 },
    { name: 'Lof', x: 612, y: 722 },
    { name: 'Broka', x: 320, y: 685 },
    { name: 'Thet', x: 225, y: 705 },
    { name: 'Egen', x: 275, y: 717 },
  ],
};

const SOUTHERN_SOMMERLUND: BookMap = {
  width: 1024,
  height: 776,
  places: [
    { name: 'Holmgard', x: 265, y: 92 },
    { name: 'Ragadorn', x: 557, y: 138 },
    { name: 'Ryme', x: 812, y: 255 },
    { name: 'Pass of Moytura', x: 275, y: 195 },
    { name: 'Durncrag Mountains', x: 115, y: 215 },
    { name: 'Wildlands', x: 440, y: 285, aliases: ['Wild Lands'] },
    { name: 'Eshnar', x: 258, y: 382 },
    { name: 'Temel', x: 458, y: 395 },
    { name: 'Maaken Range', x: 400, y: 395 },
    { name: 'Kadan', x: 665, y: 392 },
    { name: 'Cloeasia', x: 700, y: 483 },
    { name: 'Lujar', x: 640, y: 470 },
    { name: 'Kuchek', x: 727, y: 500 },
    { name: 'Samuz', x: 815, y: 540 },
    { name: 'Ferufezan', x: 800, y: 635 },
    { name: 'Lohn', x: 880, y: 672 },
    { name: 'Vakar', x: 558, y: 568 },
    { name: 'Vakar Mountains', x: 645, y: 585 },
    { name: 'Casiorn', x: 385, y: 605 },
    { name: 'Oasis', x: 455, y: 610 },
    { name: 'Dry Main', x: 440, y: 690 },
    { name: 'Vassagonia', x: 755, y: 665 },
    { name: 'Maakenmire Swamp', x: 400, y: 480, aliases: ['Maakenmire'] },
    { name: 'Maakengorge', x: 140, y: 540 },
    { name: 'Quarlen', x: 70, y: 630 },
    { name: 'Ruins of Maken', x: 155, y: 505 },
    { name: 'Ruanon Forest', x: 140, y: 388 },
    { name: 'Ruanon', x: 170, y: 440 },
    { name: 'Mudgraves', x: 520, y: 440 },
    { name: 'Bone Hills', x: 590, y: 490 },
    { name: 'Lakuri Islands', x: 955, y: 455 },
    { name: 'Maaken Mines', x: 190, y: 478 },
    { name: 'Quarlen Range', x: 60, y: 572 },
    { name: 'Gulf of Durenor', x: 520, y: 70 },
  ],
};

const VASSAGONIA: BookMap = {
  width: 1024,
  height: 823,
  places: [
    { name: 'Kuchek', x: 45, y: 60 },
    { name: 'Samiz', x: 140, y: 108, aliases: ['Samuz'] },
    { name: 'Ferufezan', x: 120, y: 170 },
    { name: 'Lohn', x: 195, y: 210 },
    { name: 'Kara Kala', x: 335, y: 190 },
    { name: 'Lyam', x: 410, y: 138 },
    { name: 'Chiras', x: 572, y: 262 },
    { name: 'Barrakeesh', x: 630, y: 240 },
    { name: 'Chula', x: 690, y: 285 },
    { name: 'Lake Inrahim', x: 660, y: 305 },
    { name: 'Tefa', x: 360, y: 293 },
    { name: 'Teph', x: 30, y: 335 },
    { name: 'Chahdan', x: 35, y: 462, aliases: ['Chadan'] },
    { name: 'Chahdan Pass', x: 30, y: 490 },
    { name: 'Chah Mountains', x: 100, y: 530 },
    { name: 'Omonai Pass', x: 100, y: 655 },
    { name: 'Vale of Tears', x: 180, y: 670 },
    { name: 'Dry Main', x: 270, y: 370 },
    { name: 'Mount Dhanamet', x: 295, y: 448 },
    { name: 'Dahir Mountains', x: 560, y: 340 },
    { name: 'Dahir Pass', x: 595, y: 450 },
    { name: 'Kabar Range', x: 780, y: 445 },
    { name: 'Cape Kabar', x: 800, y: 447 },
    { name: 'Koneshi Mountains', x: 620, y: 665 },
    { name: 'Bir Rabalou', x: 770, y: 590, aliases: ['Rabalou'] },
    { name: 'Ikaresh', x: 470, y: 295 },
    { name: 'Khor', x: 810, y: 683 },
    { name: 'Bisutan', x: 745, y: 745 },
    { name: 'Khordaim Islands', x: 880, y: 758 },
  ],
};

/** Cartes par code de livre Project Aon (les livres 1 et 2 partagent la même carte). */
export const BOOK_MAPS: Readonly<Record<string, BookMap>> = {
  '01fftd': LASTLANDS,
  '02fotw': LASTLANDS,
  '03tcok': KALTE,
  '04tcod': SOUTHERN_SOMMERLUND,
  '05sots': VASSAGONIA,
};

/** Nom de l'image de la carte dans le zip (`map.png`, page `map.htm`). */
export const MAP_IMAGE = 'map.png';

/** Noms (et graphies) de lieux connus pour un livre. */
export function knownPlaceNames(bookId: string): string[] {
  const map = BOOK_MAPS[bookId];
  if (!map) return [];
  return map.places.flatMap((p) => [p.name, ...(p.aliases ?? [])]);
}

/** Épingle du joueur : `<nom>|<x>|<y>` avec x et y en fractions (0 à 1) de l'image. */
export function parsePin(entry: string): { name: string; x: number; y: number } | null {
  const [name, x, y] = entry.split('|');
  const fx = Number(x);
  const fy = Number(y);
  return name && fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1 ? { name, x: fx, y: fy } : null;
}

/**
 * Position d'un lieu sur la carte, en fractions (0 à 1) de l'image : épingle du joueur d'abord, puis lieu
 * connu du livre (graphies comprises, sans tenir compte de la casse). `null` si inconnu.
 */
export function findPlace(
  bookId: string,
  name: string,
  pins: readonly string[] = [],
): { x: number; y: number } | null {
  const wanted = name.trim().toLowerCase();
  for (const entry of pins) {
    const pin = parsePin(entry);
    if (pin && pin.name.toLowerCase() === wanted) return { x: pin.x, y: pin.y };
  }
  const map = BOOK_MAPS[bookId];
  const place = map?.places.find((p) =>
    [p.name, ...(p.aliases ?? [])].some((n) => n.toLowerCase() === wanted),
  );
  return map && place ? { x: place.x / map.width, y: place.y / map.height } : null;
}
