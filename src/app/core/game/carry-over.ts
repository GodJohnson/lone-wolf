import { Character } from './game.models';
import { SeriesRules } from './rules';

/**
 * Passage d'un livre au suivant dans la série Kaï (livres 2 à 5). Règles des livres : on reporte
 * HABILETÉ, ENDURANCE, disciplines, armes et objets spéciaux ; l'or s'ajoute à celui du nouveau
 * livre ; le sac à dos et les Repas ne sont pas reportés ; on gagne une discipline de plus.
 */
export interface CarriedHero {
  /** Personnage de départ du nouveau livre, avant l'équipement propre à ce livre. */
  character: Character;
  /** Disciplines reportées (verrouillées dans le formulaire). */
  disciplines: string[];
}

export function carryOver(
  previous: Character,
  bookDisciplines: readonly string[],
  /** Le nouveau livre ouvre une autre série (Kaï → Magnakai) : on rechoisit ses Disciplines. */
  newSeries = false,
): CarriedHero {
  const known = new Map(bookDisciplines.map((d) => [d.toLowerCase(), d]));
  const disciplines = newSeries
    ? []
    : previous.disciplines.map((d) => known.get(d.toLowerCase()) ?? d);
  return {
    disciplines,
    character: {
      ...previous,
      // L'ENDURANCE reportée est le total de départ : les blessures du livre précédent sont soignées.
      endurance: previous.enduranceMax,
      disciplines,
      // Armes maîtrisées, rangs et bonus de cercles ne passent pas d'une série à l'autre.
      ...(newSeries ? { weaponskill: null, weaponmastery: undefined, loreApplied: undefined } : {}),
      backpack: [],
      meals: 0,
      // Ce qui était « mis de côté » (confiscation…) n'est pas repris : le coffre du monastère, si.
      stash: undefined,
    },
  };
}

/** Grants fixes du nouveau livre déjà possédés (ex. la carte), à ne pas ajouter en double. */
export function alreadyOwned(character: Character, name: string): boolean {
  const lower = name.toLowerCase();
  return [...character.weapons, ...character.specialItems].some((i) => i.toLowerCase() === lower);
}

/**
 * Livre suivant dont les règles de passage sont connues, ou null : livres 1 à 5 (Kaï, le livre 6
 * ouvrant la série Magnakai) et 6 à 11 (Magnakai).
 */
export function nextBookNumber(number: number, rules: SeriesRules | null): number | null {
  if (!rules) return null;
  const last = rules.loreCircles ? 11 : 5;
  const first = rules.loreCircles ? 6 : 1;
  return number >= first && number <= last ? number + 1 : null;
}
