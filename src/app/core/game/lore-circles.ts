import { Character } from './game.models';
import { hasDiscipline } from './rules';

/**
 * Cercles de Lore des Disciplines Magnakai (livre 6, « Lore-circles of the Magnakai ») : maîtriser toutes
 * les Disciplines d'un cercle ajoute des points à HABILETÉ et ENDURANCE de base.
 */
export interface LoreCircle {
  name: string;
  disciplines: readonly string[];
  cs: number;
  ep: number;
}

export const LORE_CIRCLES: readonly LoreCircle[] = [
  { name: 'Circle of Fire', disciplines: ['Weaponmastery', 'Huntmastery'], cs: 1, ep: 2 },
  { name: 'Circle of Light', disciplines: ['Animal Control', 'Curing'], cs: 0, ep: 3 },
  {
    name: 'Circle of Solaris',
    disciplines: ['Invisibility', 'Huntmastery', 'Pathsmanship'],
    cs: 1,
    ep: 3,
  },
  {
    name: 'Circle of the Spirit',
    disciplines: ['Psi-surge', 'Psi-screen', 'Nexus', 'Divination'],
    cs: 3,
    ep: 3,
  },
];

export function completedCircles(character: Character): LoreCircle[] {
  return LORE_CIRCLES.filter((c) => c.disciplines.every((d) => hasDiscipline(character, d)));
}

export function loreBonus(character: Character): { cs: number; ep: number } {
  return completedCircles(character).reduce(
    (sum, c) => ({ cs: sum.cs + c.cs, ep: sum.ep + c.ep }),
    { cs: 0, ep: 0 },
  );
}

/**
 * Ajuste HABILETÉ et ENDURANCE de base pour refléter les Cercles de Lore accomplis : seule la différence
 * avec le bonus déjà appliqué est ajoutée ou retirée (les corrections du joueur sont donc conservées).
 */
export function syncLoreBonus(character: Character): Character {
  const target = loreBonus(character);
  const applied = character.loreApplied ?? { cs: 0, ep: 0 };
  const dCs = target.cs - applied.cs;
  const dEp = target.ep - applied.ep;
  if (!dCs && !dEp) return character;
  const enduranceMax = Math.max(1, character.enduranceMax + dEp);
  return {
    ...character,
    combatSkill: Math.max(0, character.combatSkill + dCs),
    enduranceMax,
    // Un bonus gagné s'ajoute aussi à l'ENDURANCE courante ; un bonus perdu ne la laisse pas dépasser le total.
    endurance: Math.min(enduranceMax, Math.max(0, character.endurance + Math.max(dEp, 0))),
    loreApplied: target,
  };
}
