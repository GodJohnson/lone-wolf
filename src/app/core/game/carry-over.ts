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

export function carryOver(previous: Character, bookDisciplines: readonly string[]): CarriedHero {
  const known = new Map(bookDisciplines.map((d) => [d.toLowerCase(), d]));
  const disciplines = previous.disciplines.map((d) => known.get(d.toLowerCase()) ?? d);
  return {
    disciplines,
    character: {
      ...previous,
      // L'ENDURANCE reportée est le total de départ : les blessures du livre précédent sont soignées.
      endurance: previous.enduranceMax,
      disciplines,
      backpack: [],
      meals: 0,
    },
  };
}

/** Grants fixes du nouveau livre déjà possédés (ex. la carte), à ne pas ajouter en double. */
export function alreadyOwned(character: Character, name: string): boolean {
  const lower = name.toLowerCase();
  return [...character.weapons, ...character.specialItems].some((i) => i.toLowerCase() === lower);
}

/** Livre suivant dans la série Kaï (1 à 5), ou null. */
export function nextBookNumber(number: number, rules: SeriesRules | null): number | null {
  return rules && number >= 1 && number <= 4 ? number + 1 : null;
}
