import { Character } from './game.models';
import { isSkilledWeapon } from './rules';

/**
 * Bonus aux tirs à l'arc du livre 6 : quand le texte demande de tirer un nombre dans la Table de hasard
 * pour un tir, on ajoute +3 avec la Discipline Weaponmastery avec Bow, et +3 avec le Silver Bow of Duadon
 * (prix du tournoi d'archerie) ; les deux se cumulent (6 au total). Ces bonus ne valent que pour juger la
 * réussite d'un tir (note du §252) ; en combat, Weaponmastery donne +3 HAB (note du §26).
 */
export const BOW_BONUS = 3;

/** Le Silver Bow of Duadon (aussi écrit « silver oak bow ») est-il dans les Objets spéciaux ? */
export function hasSilverBow(character: Character): boolean {
  return character.specialItems.some((i) => /silver\s+(?:oak(?:en)?\s+)?bow|duadon/i.test(i));
}

export function bowShotBonus(character: Character): {
  mastery: number;
  silverBow: number;
  total: number;
} {
  const mastery = isSkilledWeapon(character, 'Bow') ? BOW_BONUS : 0;
  const silverBow = hasSilverBow(character) ? BOW_BONUS : 0;
  return { mastery, silverBow, total: mastery + silverBow };
}
