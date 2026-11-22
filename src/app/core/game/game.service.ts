import { Injectable, computed, signal } from '@angular/core';
import { Enemy } from '../book/book.models';
import { database } from '../storage/database';
import { BuffError, swallow, swallowInCombat } from './buffs';
import { Character, CombatState, GameState } from './game.models';
import { randomNumber } from './random';
import {
  Grant,
  InventoryError,
  applyGrants,
  itemEffect,
  ItemSlot,
  MealChoice,
  addItem,
  removeItem,
  resolveMeal,
  useItem,
} from './equipment';
import { SeriesRules, effectiveCombatSkill, healingOnLeave, playRound, startCombat } from './rules';

/**
 * État de la partie en cours. Chaque modification est immédiatement persistée en IndexedDB :
 * le joueur peut fermer l'onglet à tout moment sans perdre sa progression.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly _state = signal<GameState | null>(null);
  readonly state = this._state.asReadonly();
  readonly character = computed(() => this._state()?.character ?? null);
  readonly combat = computed(() => this._state()?.combat ?? null);
  readonly isDead = computed(() => (this._state()?.character.endurance ?? 1) <= 0);
  readonly combatSkill = computed(() => {
    const state = this._state();
    if (!state) return null;
    return effectiveCombatSkill(
      state.character,
      state.combat ?? { modifier: 0, useMindblast: false },
    );
  });

  async load(bookId: string): Promise<GameState | null> {
    if (this._state()?.bookId === bookId) return this._state();
    const game = (await (await database()).get('games', bookId)) ?? null;
    this.undoStack.set([]);
    this._state.set(game);
    return game;
  }

  /** Lit la partie d'un livre sans en faire la partie courante (ex. pour la reprendre au livre suivant). */
  async peek(bookId: string): Promise<GameState | undefined> {
    return (await database()).get('games', bookId);
  }

  async exists(bookId: string): Promise<boolean> {
    return !!(await (await database()).get('games', bookId));
  }

  /** Remplace la partie du livre par une partie reçue d'un autre appareil (déjà validée). */
  async importGame(state: GameState): Promise<void> {
    this.undoStack.set([]);
    await this.commit({ ...state, combat: null });
  }

  /** Un événement du récit est-il déjà survenu dans cette partie ? */
  hasFlag(flag: string): boolean {
    return !!this._state()?.flags?.includes(flag);
  }

  /** Effectue un changement du personnage une seule fois par partie (ex. jeton remis à l'entrée). */
  async doOnce(flag: string, update: (c: Character) => Character): Promise<boolean> {
    const state = this._state();
    if (!state || state.flags?.includes(flag)) return false;
    this.remember(state.character);
    await this.commit({
      ...state,
      character: update(state.character),
      flags: [...(state.flags ?? []), flag],
    });
    return true;
  }

  /** Marque le livre comme terminé (la partie est conservée pour pouvoir la reprendre au livre suivant). */
  async finishBook(): Promise<void> {
    const state = this._state();
    if (!state) return;
    await this.commit({ ...state, finished: true, combat: null });
  }

  async newGame(bookId: string, character: Character): Promise<void> {
    this.undoStack.set([]);
    const now = new Date().toISOString();
    await this.commit({
      bookId,
      section: 1,
      history: [],
      character,
      combat: null,
      foughtIn: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  async goTo(section: number): Promise<void> {
    const state = this._state();
    if (!state || section === state.section) return;
    const character = healingOnLeave(state.character, state.section, state.foughtIn);
    await this.commit({
      ...state,
      section,
      history: [...state.history, state.section],
      character,
      combat: null,
      mealResolved: false,
    });
  }

  /** Retour à la section précédente (sans annuler les changements de la Feuille d'aventure). */
  async back(): Promise<void> {
    const state = this._state();
    if (!state?.history.length) return;
    const history = state.history.slice(0, -1);
    await this.commit({
      ...state,
      section: state.history[state.history.length - 1],
      history,
      combat: null,
      mealResolved: false,
    });
  }

  /**
   * Modifie le personnage. `group` regroupe une rafale de modifications du même champ (ex. 43 clics sur
   * « − ») : un seul « Annuler » les défait toutes.
   */
  async updateCharacter(update: (c: Character) => Character, group?: string): Promise<void> {
    const state = this._state();
    if (!state) return;
    this.remember(state.character, group);
    await this.commit({ ...state, character: update(state.character) });
  }

  // ---- Annuler (modifications du personnage, en mémoire pour la session) ----
  private readonly undoStack = signal<Character[]>([]);
  private lastGroup: { key: string; at: number } | null = null;
  readonly canUndo = computed(() => this.undoStack().length > 0);

  private remember(character: Character, group?: string): void {
    const now = Date.now();
    const sameBurst = !!group && this.lastGroup?.key === group && now - this.lastGroup.at < 3000;
    this.lastGroup = group ? { key: group, at: now } : null;
    if (sameBurst) {
      if (this.lastGroup) this.lastGroup.at = now;
      return;
    }
    this.undoStack.update((stack) => [...stack.slice(-29), character]);
  }

  /** Revient à l'état du personnage avant la dernière modification (ou la dernière rafale). */
  async undo(): Promise<void> {
    const state = this._state();
    const stack = this.undoStack();
    if (!state || !stack.length) return;
    this.undoStack.set(stack.slice(0, -1));
    this.lastGroup = null;
    await this.commit({ ...state, character: stack[stack.length - 1] });
  }

  /** Ajoute un objet en respectant les capacités ; retourne l'erreur éventuelle. */
  async addItem(slot: ItemSlot, name: string, rules: SeriesRules): Promise<InventoryError | null> {
    const state = this._state();
    if (!state) return null;
    const result = addItem(state.character, slot, name, rules);
    if (result.error) return result.error;
    this.remember(state.character);
    await this.commit({ ...state, character: result.character });
    return null;
  }

  /** Ajoute un objet, de l'or ou des Repas trouvés ; retourne l'erreur éventuelle (capacité). */
  async grant(grant: Grant | readonly Grant[], rules: SeriesRules): Promise<InventoryError | null> {
    const state = this._state();
    if (!state) return null;
    const { character, errors } = applyGrants(
      state.character,
      Array.isArray(grant) ? grant : [grant as Grant],
      rules,
    );
    if (errors.length) return errors[0];
    this.remember(state.character);
    await this.commit({ ...state, character });
    return null;
  }

  /**
   * Achat atomique : débite le prix puis ajoute l'objet (un seul « Annuler » défait tout). Rien n'est
   * modifié si l'or manque ou si l'objet ne rentre pas.
   */
  async buy(
    price: number,
    grant: Grant | readonly Grant[] | null,
    rules: SeriesRules,
  ): Promise<InventoryError | 'noGold' | null> {
    const state = this._state();
    if (!state) return null;
    if (state.character.gold < price) return 'noGold';
    let character = { ...state.character, gold: state.character.gold - price };
    if (grant) {
      const result = applyGrants(character, Array.isArray(grant) ? grant : [grant as Grant], rules);
      if (result.errors.length) return result.errors[0];
      character = result.character;
    }
    this.remember(state.character);
    await this.commit({ ...state, character });
    return null;
  }

  /** Paie un prix (choix « pay N Gold Crowns ») ; faux si l'or ne suffit pas. */
  async pay(price: number): Promise<boolean> {
    const state = this._state();
    if (!state || state.character.gold < price) return false;
    this.remember(state.character);
    await this.commit({
      ...state,
      character: { ...state.character, gold: state.character.gold - price },
    });
    return true;
  }

  async removeItem(slot: ItemSlot, index: number): Promise<void> {
    await this.updateCharacter((c) => removeItem(c, slot, index));
  }

  /** Boit une potion ou avale un objet à effet temporaire ; retourne l'erreur éventuelle (effet déjà actif). */
  async useItem(index: number): Promise<BuffError | null> {
    const state = this._state();
    if (!state) return null;
    if (itemEffect(state.character.backpack[index] ?? '')?.buff) {
      const result = swallow(state.character, index);
      if (result.error) return result.error;
      this.remember(state.character);
      await this.commit({ ...state, character: result.character });
      return null;
    }
    await this.updateCharacter((c) => useItem(c, index));
    return null;
  }

  /** Avale un objet à effet avant le premier assaut du combat en cours. */
  async swallowInCombat(index: number): Promise<BuffError | null> {
    const state = this._state();
    if (!state?.combat) return null;
    const result = swallowInCombat(state.character, state.combat, index);
    if (result.error) return result.error;
    this.remember(state.character);
    await this.commit({ ...state, character: result.character, combat: result.combat });
    return null;
  }

  /** Retire un effet prêt pour le prochain combat (avalé par erreur). */
  async dropBuff(index: number): Promise<void> {
    await this.updateCharacter((c) => {
      const buffs = (c.buffs ?? []).filter((_, i) => i !== index);
      return { ...c, buffs: buffs.length ? buffs : undefined };
    });
  }

  async resolveMeal(choice: MealChoice): Promise<void> {
    const state = this._state();
    if (!state) return;
    this.remember(state.character);
    await this.commit({
      ...state,
      character: resolveMeal(state.character, choice),
      mealResolved: true,
    });
  }

  async startCombat(blockIndex: number, enemy: Enemy, mindforce = 0): Promise<void> {
    const state = this._state();
    if (!state) return;
    await this.commit({
      ...state,
      combat: startCombat(state.section, blockIndex, enemy, state.character, mindforce),
      // Les effets avalés avant le combat sont passés dans le combat : ils ne restent pas sur le personnage.
      character: state.character.buffs ? { ...state.character, buffs: undefined } : state.character,
      foughtIn: state.foughtIn.includes(state.section)
        ? state.foughtIn
        : [...state.foughtIn, state.section],
    });
  }

  async updateCombat(update: (c: CombatState) => CombatState): Promise<void> {
    const state = this._state();
    if (!state?.combat) return;
    await this.commit({ ...state, combat: update(state.combat) });
  }

  /** Joue un assaut avec un tirage aléatoire. Retourne le nombre tiré. */
  async fightRound(evade = false): Promise<number | null> {
    const state = this._state();
    if (!state?.combat) return null;
    const roll = randomNumber();
    const result = playRound(state.combat, state.character, roll, evade);
    await this.commit({ ...state, combat: result.combat, character: result.character });
    return roll;
  }

  async closeCombat(): Promise<void> {
    const state = this._state();
    if (!state) return;
    await this.commit({ ...state, combat: null });
  }

  async deleteGame(bookId: string): Promise<void> {
    await (await database()).delete('games', bookId);
    if (this._state()?.bookId === bookId) this._state.set(null);
  }

  private async commit(state: GameState): Promise<void> {
    const next = { ...state, updatedAt: new Date().toISOString() };
    this._state.set(next);
    await (await database()).put('games', next);
  }
}
