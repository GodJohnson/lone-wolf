import { Buff, Character, CombatState } from './game.models';
import { itemEffect } from './equipment';

/**
 * Effets temporaires d'objets consommés (livre 6 §123 : Alether Berries, +2 HAB pour la durée d'un combat,
 * une poignée par combat). Avalés hors combat, ils attendent le prochain combat (`Character.buffs`) ; au
 * début d'un combat ils passent dans `CombatState.buffs` et s'éteignent avec lui.
 */
export type BuffError = 'notBuff' | 'buffActive';

function buffOf(name: string): Buff | null {
  const effect = itemEffect(name)?.buff;
  return effect ? { name: name.trim(), combatSkill: effect.combatSkill } : null;
}

const sameBuff = (a: Buff, b: Buff) => a.name.toLowerCase() === b.name.toLowerCase();

/** Avale l'objet du sac à dos : il sort du sac et son effet est prêt pour le prochain combat. */
export function swallow(
  character: Character,
  index: number,
  /** Effets déjà actifs dans le combat en cours (un seul par combat). */
  active: readonly Buff[] = [],
): { character: Character; buff?: Buff; error?: BuffError } {
  const buff = buffOf(character.backpack[index] ?? '');
  if (!buff) return { character, error: 'notBuff' };
  if ([...(character.buffs ?? []), ...active].some((b) => sameBuff(b, buff))) {
    return { character, error: 'buffActive' };
  }
  return {
    character: {
      ...character,
      backpack: character.backpack.filter((_, i) => i !== index),
      buffs: [...(character.buffs ?? []), buff],
    },
    buff,
  };
}

/** Avale l'objet avant le premier assaut du combat en cours : l'effet vaut pour ce combat. */
export function swallowInCombat(
  character: Character,
  combat: CombatState,
  index: number,
): { character: Character; combat: CombatState; error?: BuffError } {
  const result = swallow({ ...character, buffs: undefined }, index, combat.buffs ?? []);
  if (result.error || !result.buff) return { character, combat, error: result.error };
  return {
    character: { ...result.character, buffs: character.buffs },
    combat: { ...combat, buffs: [...(combat.buffs ?? []), result.buff] },
  };
}

/** Bonus d'HABILETÉ total des effets d'un combat. */
export function buffsBonus(buffs: readonly Buff[] | undefined): number {
  return (buffs ?? []).reduce((sum, b) => sum + b.combatSkill, 0);
}
