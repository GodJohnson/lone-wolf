import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ItemListComponent } from '../action-chart/item-list.component';
import { ItemSlot, backpackLoad } from '../../core/game/equipment';
import { GameService } from '../../core/game/game.service';
import { SeriesRules, isSkilledWeapon } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';

/** Fiche du personnage en colonne latérale (bureau) : toujours visible pendant la lecture. */
@Component({
  selector: 'lw-character-panel',
  imports: [RouterLink, ItemListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (character(); as c) {
      <section class="card char-panel">
        <h2>{{ i18n.t('chart.title') }}</h2>
        <div class="char-stats">
          <div class="stat">
            <span class="stat__label">{{ i18n.t('chart.combatSkill') }}</span>
            <span class="stat__value">{{ c.combatSkill }}</span>
            @if (game.combatSkill(); as b) {
              @if (b.total !== c.combatSkill) {
                <span class="stat__hint">{{ i18n.t('combat.cs') }} {{ b.total }}</span>
              }
            }
          </div>
          <div class="stat">
            <span class="stat__label">{{ i18n.t('chart.endurance') }}</span>
            <div class="stepper">
              <button
                type="button"
                class="icon-button"
                (click)="adjust('endurance', -1)"
                aria-label="-1"
              >
                −
              </button>
              <span class="stat__value" [class.danger]="c.endurance <= 5">{{ c.endurance }}</span>
              <button
                type="button"
                class="icon-button"
                (click)="adjust('endurance', 1)"
                aria-label="+1"
              >
                +
              </button>
            </div>
            <span class="stat__hint">/ {{ c.enduranceMax }}</span>
          </div>
          <div class="stat">
            <span class="stat__label">{{ i18n.t('chart.gold') }}</span>
            <div class="stepper">
              <button
                type="button"
                class="icon-button"
                (click)="adjust('gold', -1)"
                aria-label="-1"
              >
                −
              </button>
              <span class="stat__value">{{ c.gold }}</span>
              <button type="button" class="icon-button" (click)="adjust('gold', 1)" aria-label="+1">
                +
              </button>
            </div>
          </div>
          <div class="stat">
            <span class="stat__label">{{ i18n.t('chart.meals') }}</span>
            <div class="stepper">
              <button
                type="button"
                class="icon-button"
                (click)="adjust('meals', -1)"
                aria-label="-1"
              >
                −
              </button>
              <span class="stat__value">{{ c.meals }}</span>
              <button
                type="button"
                class="icon-button"
                (click)="adjust('meals', 1)"
                aria-label="+1"
              >
                +
              </button>
            </div>
          </div>
        </div>
        <div class="chips">
          @for (d of c.disciplines; track d) {
            <span class="chip chip--on">{{ d }}</span>
          }
        </div>
        @if (error(); as message) {
          <p class="notice notice--error" role="alert">{{ message }}</p>
        }
      </section>

      <section class="card">
        <lw-item-list
          slot="weapons"
          [title]="i18n.t('chart.weapons', { count: c.weapons.length, max: rules().maxWeapons })"
          [items]="c.weapons"
          [full]="c.weapons.length >= rules().maxWeapons"
          [extraHint]="weaponHint"
          (added)="add('weapons', $event)"
          (removed)="game.removeItem('weapons', $event)"
        />
      </section>
      <section class="card">
        <lw-item-list
          slot="backpack"
          [title]="i18n.t('chart.backpack', { count: load(), max: rules().maxBackpackItems })"
          [items]="c.backpack"
          [full]="load() >= rules().maxBackpackItems"
          [canUse]="!inCombat() && c.endurance < c.enduranceMax"
          (added)="add('backpack', $event)"
          (removed)="game.removeItem('backpack', $event)"
          (used)="game.useItem($event)"
        />
      </section>
      <section class="card">
        <lw-item-list
          slot="specialItems"
          [title]="i18n.t('chart.specialItems')"
          [items]="c.specialItems"
          (added)="add('specialItems', $event)"
          (removed)="game.removeItem('specialItems', $event)"
        />
      </section>

      <div class="side-actions">
        <button type="button" class="button" (click)="random.emit()">
          🎲 {{ i18n.t('reader.random') }}
        </button>
        <a class="button" [routerLink]="['/book', bookId(), 'chart']"
          >📜 {{ i18n.t('desktop.fullChart') }}</a
        >
      </div>
    }
  `,
})
export class CharacterPanelComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly game = inject(GameService);

  readonly bookId = input.required<string>();
  readonly rules = input.required<SeriesRules>();
  readonly random = output<void>();

  protected readonly character = this.game.character;
  protected readonly error = signal<string | null>(null);
  protected readonly inCombat = computed(() => this.game.combat()?.outcome === 'ongoing');
  protected readonly load = computed(() => {
    const c = this.character();
    return c ? backpackLoad(c) : 0;
  });

  protected readonly weaponHint = (name: string): string => {
    const c = this.character();
    return c && isSkilledWeapon(c, name) ? `+2 ${this.i18n.t('combat.cs')} ✓` : '';
  };

  protected adjust(field: 'endurance' | 'gold' | 'meals', delta: number): void {
    this.error.set(null);
    const rules = this.rules();
    if (field === 'meals' && delta > 0 && this.load() >= rules.maxBackpackItems) {
      this.error.set(this.i18n.t('chart.error.backpackFull'));
      return;
    }
    this.game.updateCharacter((c) => {
      const next = { ...c, [field]: Math.max(0, c[field] + delta) };
      if (field === 'gold') next.gold = Math.min(next.gold, rules.maxGold);
      if (field === 'endurance') next.endurance = Math.min(next.endurance, next.enduranceMax);
      return next;
    });
  }

  protected async add(slot: ItemSlot, name: string): Promise<void> {
    const error = await this.game.addItem(slot, name, this.rules());
    this.error.set(error ? this.i18n.t(`chart.error.${error}`) : null);
  }
}
