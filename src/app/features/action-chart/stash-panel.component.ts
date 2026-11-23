import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { GameService } from '../../core/game/game.service';
import { SeriesRules } from '../../core/game/rules';
import {
  StashField,
  StashPick,
  StashSlot,
  StashTarget,
  discard,
  getBack,
  pickAll,
  putAside,
  stashCount,
} from '../../core/game/stash';
import { I18nService } from '../../core/i18n/i18n.service';
import { MessageKey } from '../../core/i18n/messages';

const SLOTS: StashSlot[] = ['weapons', 'backpack', 'specialItems'];

/**
 * Mettre de côté objets, or et Repas (confiscation, objets laissés en route) pour les retrouver si le
 * récit les rend : ils ne comptent plus sur la Feuille, mais restent listés ici.
 */
@Component({
  selector: 'lw-stash-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stash">
      <div class="card__header">
        <h2>{{ i18n.t(key('title')) }}</h2>
        <button
          type="button"
          class="button button--small"
          [disabled]="!anything()"
          (click)="openSheet()"
        >
          {{ i18n.t(key('action')) }}
        </button>
      </div>
      @if (entries().length) {
        <ul class="item-list">
          @for (entry of entries(); track entry.key) {
            <li>
              <span>{{ entry.label }}</span>
              <span class="item-actions">
                <button type="button" class="button button--small" (click)="restore(entry.target)">
                  {{ i18n.t('stash.restore') }}
                </button>
                <button
                  type="button"
                  class="icon-button"
                  (click)="forget(entry.target)"
                  [attr.aria-label]="i18n.t('stash.discard') + ' ' + entry.label"
                >
                  ✕
                </button>
              </span>
            </li>
          }
        </ul>
        <button type="button" class="button button--small button--block" (click)="restoreAll()">
          {{ i18n.t('stash.restoreAll') }}
        </button>
      } @else {
        <p class="small muted">{{ i18n.t(key('hint')) }}</p>
      }
      @if (error(); as message) {
        <p class="notice notice--error" role="alert">{{ message }}</p>
      }
    </section>

    @if (sheetOpen()) {
      <div class="sheet-backdrop" (click)="sheetOpen.set(false)"></div>
      <section class="sheet stash-sheet" role="dialog" aria-modal="true">
        <h2>{{ i18n.t(key('sheetTitle')) }}</h2>
        <div class="chips">
          @for (option of options(); track option.key) {
            <button
              type="button"
              class="chip"
              [class.chip--on]="selected().has(option.key)"
              [attr.aria-pressed]="selected().has(option.key)"
              (click)="toggle(option.key)"
            >
              {{ option.label }}
            </button>
          }
        </div>
        <div class="stash-sheet__quick">
          <button type="button" class="button button--ghost button--small" (click)="selectAll()">
            {{ i18n.t('stash.all') }}
          </button>
          <button
            type="button"
            class="button button--ghost button--small"
            (click)="selected.set(empty)"
          >
            {{ i18n.t('stash.none') }}
          </button>
        </div>
        <div class="sheet__actions">
          <button type="button" class="button" (click)="sheetOpen.set(false)">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="button button--primary"
            [disabled]="!selected().size"
            (click)="confirm()"
          >
            {{ i18n.t(key('confirm'), { n: selected().size }) }}
          </button>
        </div>
      </section>
    }
  `,
})
export class StashPanelComponent {
  protected readonly i18n = inject(I18nService);
  private readonly game = inject(GameService);
  readonly rules = input.required<SeriesRules>();
  /** Réserve gérée : « mis de côté » (défaut) ou coffre du monastère Kai. */
  readonly field = input<StashField>('stash');

  /** Libellé propre à la réserve (`stash.*` ou `monastery.*`). */
  protected key(name: 'title' | 'action' | 'hint' | 'sheetTitle' | 'confirm'): MessageKey {
    return `${this.field() === 'monastery' ? 'monastery' : 'stash'}.${name}` as MessageKey;
  }

  protected readonly sheetOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly empty: ReadonlySet<string> = new Set();
  protected readonly selected = signal<ReadonlySet<string>>(this.empty);

  private readonly character = this.game.character;
  protected readonly anything = computed(() => {
    const c = this.character();
    return (
      !!c &&
      (c.weapons.length + c.backpack.length + c.specialItems.length > 0 ||
        c.gold > 0 ||
        c.meals > 0)
    );
  });

  /** Éléments que l'on peut mettre de côté : chacun est une pastille à cocher. */
  protected readonly options = computed(() => {
    const c = this.character();
    if (!c) return [];
    const options = SLOTS.flatMap((slot) =>
      c[slot].map((name, index) => ({ key: `${slot}:${index}`, label: name })),
    );
    if (c.gold > 0)
      options.push({ key: 'gold', label: `🪙 ${this.i18n.t('stash.gold', { n: c.gold })}` });
    if (c.meals > 0)
      options.push({ key: 'meals', label: `🍖 ${this.i18n.t('stash.meals', { n: c.meals })}` });
    return options;
  });

  /** Ce qui est de côté, avec de quoi le récupérer ou l'abandonner. */
  protected readonly entries = computed(() => {
    const stash = this.character()?.[this.field()];
    if (!stash || !stashCount(stash)) return [];
    const rows: { key: string; label: string; target: StashTarget }[] = [];
    for (const slot of SLOTS) {
      stash[slot].forEach((name, index) =>
        rows.push({ key: `${slot}:${index}`, label: name, target: { slot, index } }),
      );
    }
    if (stash.gold > 0)
      rows.push({
        key: 'gold',
        label: `🪙 ${this.i18n.t('stash.gold', { n: stash.gold })}`,
        target: 'gold',
      });
    if (stash.meals > 0)
      rows.push({
        key: 'meals',
        label: `🍖 ${this.i18n.t('stash.meals', { n: stash.meals })}`,
        target: 'meals',
      });
    return rows;
  });

  protected openSheet(): void {
    this.selected.set(new Set(this.options().map((o) => o.key)));
    this.sheetOpen.set(true);
  }

  protected selectAll(): void {
    this.selected.set(new Set(this.options().map((o) => o.key)));
  }

  protected toggle(key: string): void {
    const next = new Set(this.selected());
    if (!next.delete(key)) next.add(key);
    this.selected.set(next);
  }

  protected async confirm(): Promise<void> {
    const keys = this.selected();
    const pick: StashPick = {
      weapons: [],
      backpack: [],
      specialItems: [],
      gold: keys.has('gold'),
      meals: keys.has('meals'),
    };
    for (const key of keys) {
      const [slot, index] = key.split(':');
      if (SLOTS.includes(slot as StashSlot)) pick[slot as StashSlot].push(Number(index));
    }
    this.sheetOpen.set(false);
    this.error.set(null);
    await this.game.updateCharacter((c) => putAside(c, pick, this.field()));
  }

  protected async restore(target: StashTarget): Promise<void> {
    this.error.set(null);
    const c = this.character();
    if (!c) return;
    const result = getBack(c, this.rules(), target, this.field());
    if (result.error) this.error.set(this.i18n.t(`chart.error.${result.error}` as MessageKey));
    if (result.character !== c) await this.game.updateCharacter(() => result.character);
  }

  protected async restoreAll(): Promise<void> {
    this.error.set(null);
    const c = this.character();
    if (!c) return;
    let current = c;
    let failed: string | null = null;
    // Dans l'ordre d'origine : chaque objet récupéré quitte la tête de sa liste, un objet refusé y reste.
    const stuck: Record<string, number> = {};
    for (const entry of this.entries()) {
      const target =
        typeof entry.target === 'string'
          ? entry.target
          : { slot: entry.target.slot, index: stuck[entry.target.slot] ?? 0 };
      const result = getBack(current, this.rules(), target, this.field());
      if (result.error) {
        failed = this.i18n.t(`chart.error.${result.error}` as MessageKey);
        if (typeof target !== 'string') stuck[target.slot] = (stuck[target.slot] ?? 0) + 1;
      }
      current = result.character;
    }
    if (failed) this.error.set(failed);
    if (current !== c) await this.game.updateCharacter(() => current);
  }

  protected async forget(target: StashTarget): Promise<void> {
    this.error.set(null);
    await this.game.updateCharacter((c) => discard(c, target, this.field()));
  }
}
