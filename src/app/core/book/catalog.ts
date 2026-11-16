import { Series } from './book.models';

/**
 * Catalogue des livres Loup Solitaire publiés par Project Aon (édition anglaise).
 * Ne contient que des métadonnées et des liens vers le point de distribution officiel :
 * le téléchargement est fait par le joueur lui-même, conformément à la licence Project Aon.
 */
export interface CatalogEntry {
  number: number;
  code: string;
  title: string;
}

export const CATALOG: readonly CatalogEntry[] = [
  { number: 1, code: '01fftd', title: 'Flight from the Dark' },
  { number: 2, code: '02fotw', title: 'Fire on the Water' },
  { number: 3, code: '03tcok', title: 'The Caverns of Kalte' },
  { number: 4, code: '04tcod', title: 'The Chasm of Doom' },
  { number: 5, code: '05sots', title: 'Shadow on the Sand' },
  { number: 6, code: '06tkot', title: 'The Kingdoms of Terror' },
  { number: 7, code: '07cd', title: 'Castle Death' },
  { number: 8, code: '08tjoh', title: 'The Jungle of Horrors' },
  { number: 9, code: '09tcof', title: 'The Cauldron of Fear' },
  { number: 10, code: '10tdot', title: 'The Dungeons of Torgar' },
  { number: 11, code: '11tpot', title: 'The Prisoners of Time' },
  { number: 12, code: '12tmod', title: 'The Masters of Darkness' },
  { number: 13, code: '13tplor', title: 'The Plague Lords of Ruel' },
  { number: 14, code: '14tcok', title: 'The Captives of Kaag' },
  { number: 15, code: '15tdc', title: 'The Darke Crusade' },
  { number: 16, code: '16tlov', title: 'The Legacy of Vashna' },
  { number: 17, code: '17tdoi', title: 'The Deathlord of Ixia' },
  { number: 18, code: '18dotd', title: 'Dawn of the Dragons' },
  { number: 19, code: '19wb', title: "Wolf's Bane" },
  { number: 20, code: '20tcon', title: 'The Curse of Naar' },
  { number: 21, code: '21votm', title: 'Voyage of the Moonstone' },
  { number: 22, code: '22tbos', title: 'The Buccaneers of Shadaki' },
  { number: 23, code: '23mh', title: "Mydnight's Hero" },
  { number: 24, code: '24rw', title: 'Rune War' },
  { number: 25, code: '25totw', title: 'Trail of the Wolf' },
  { number: 26, code: '26tfobm', title: 'The Fall of Blood Mountain' },
  { number: 27, code: '27v', title: 'Vampirium' },
  { number: 28, code: '28thos', title: 'The Hunger of Sejanoz' },
  { number: 29, code: '29tsoc', title: 'The Storms of Chai' },
];

export const PROJECT_AON_LICENSE_URL = 'https://www.projectaon.org/en/Main/License';

export function downloadUrl(entry: CatalogEntry): string {
  return `https://www.projectaon.org/en/xhtml/lw/${entry.code}/${entry.code}.zip`;
}

export function seriesOf(bookNumber: number): Series | null {
  if (bookNumber >= 1 && bookNumber <= 5) return 'kai';
  if (bookNumber >= 6 && bookNumber <= 12) return 'magnakai';
  if (bookNumber >= 13 && bookNumber <= 20) return 'grandmaster';
  if (bookNumber >= 21 && bookNumber <= 29) return 'neworder';
  return null;
}
