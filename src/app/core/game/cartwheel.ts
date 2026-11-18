import { Character } from './game.models';

/**
 * Cartwheel, jeu de la salle de jeu de Ragadorn (livre 2, section 238). Règles du texte :
 * le joueur choisit un numéro (0-9) et une mise ; on tire un nombre dans la Table de hasard.
 * Numéro exact : 8 couronnes gagnées par couronne misée ; numéro voisin (le 0 est entre le 9 et le 1) :
 * 5 par couronne ; sinon la mise est perdue. Les gains sont plafonnés à 40 couronnes.
 */
export const CARTWHEEL_CAP = 40;
export const CARTWHEEL_SECTION = { book: '02fotw', section: 238, ruined: 169, leave: 186 } as const;
/** Jeton d'argent remis une seule fois à l'entrée : vaut 1 couronne, utilisable dans la salle seulement. */
export const SILVER_TOKEN = 'Silver Token (gaming-house)';
export const SILVER_TOKEN_FLAG = 'cartwheel-token';

export type CartwheelOutcome = 'exact' | 'near' | 'miss';

export interface CartwheelRound {
  outcome: CartwheelOutcome;
  /** Gain net (positif) ou mise perdue (négatif), après plafonnement des gains. */
  net: number;
  /** Le plafond de 40 couronnes a limité ce gain. */
  capped: boolean;
}

export function cartwheelRound(
  bet: number,
  stake: number,
  roll: number,
  winningsSoFar: number,
): CartwheelRound {
  if (![bet, roll].every((n) => Number.isInteger(n) && n >= 0 && n <= 9))
    throw new RangeError('bet/roll');
  if (!Number.isInteger(stake) || stake < 1) throw new RangeError('stake');
  const distance = Math.min((bet - roll + 10) % 10, (roll - bet + 10) % 10);
  if (distance > 1) return { outcome: 'miss', net: -stake, capped: false };
  const gross = stake * (distance === 0 ? 8 : 5);
  const room = Math.max(0, CARTWHEEL_CAP - winningsSoFar);
  return {
    outcome: distance === 0 ? 'exact' : 'near',
    net: Math.min(gross, room),
    capped: gross > room,
  };
}

export function tokens(character: Character): number {
  return character.specialItems.filter((i) => i === SILVER_TOKEN).length;
}

/** Fonds disponibles pour miser : couronnes plus jetons d'argent. */
export function bankroll(character: Character): number {
  return character.gold + tokens(character);
}

/** Mise perdue : on prend d'abord les couronnes, puis les jetons. */
export function loseStake(character: Character, stake: number): Character {
  const fromGold = Math.min(character.gold, stake);
  let remaining = stake - fromGold;
  const specialItems = [...character.specialItems];
  while (remaining > 0) {
    const i = specialItems.indexOf(SILVER_TOKEN);
    if (i < 0) break;
    specialItems.splice(i, 1);
    remaining--;
  }
  return { ...character, gold: character.gold - fromGold, specialItems };
}
