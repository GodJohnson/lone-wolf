import { Injectable, computed, signal } from '@angular/core';
import { Enemy } from '../book/book.models';
import { database } from '../storage/database';
import { Character, CombatState, GameState } from './game.models';
import { randomNumber } from './random';
import {
  InventoryError,
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
    this._state.set(game);
    return game;
  }

  async exists(bookId: string): Promise<boolean> {
    return !!(await (await database()).get('games', bookId));
  }

  async newGame(bookId: string, character: Character): Promise<void> {
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

  async updateCharacter(update: (c: Character) => Character): Promise<void> {
    const state = this._state();
    if (!state) return;
    await this.commit({ ...state, character: update(state.character) });
  }

  /** Ajoute un objet en respectant les capacités ; retourne l'erreur éventuelle. */
  async addItem(slot: ItemSlot, name: string, rules: SeriesRules): Promise<InventoryError | null> {
    const state = this._state();
    if (!state) return null;
    const result = addItem(state.character, slot, name, rules);
    if (result.error) return result.error;
    await this.commit({ ...state, character: result.character });
    return null;
  }

  async removeItem(slot: ItemSlot, index: number): Promise<void> {
    await this.updateCharacter((c) => removeItem(c, slot, index));
  }

  async useItem(index: number): Promise<void> {
    await this.updateCharacter((c) => useItem(c, index));
  }

  async resolveMeal(choice: MealChoice): Promise<void> {
    const state = this._state();
    if (!state) return;
    await this.commit({
      ...state,
      character: resolveMeal(state.character, choice),
      mealResolved: true,
    });
  }

  async startCombat(blockIndex: number, enemy: Enemy): Promise<void> {
    const state = this._state();
    if (!state) return;
    await this.commit({
      ...state,
      combat: startCombat(state.section, blockIndex, enemy, state.character),
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
