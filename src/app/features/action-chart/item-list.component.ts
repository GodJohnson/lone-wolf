import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ItemSlot, KNOWN_ITEMS, itemEffect } from '../../core/game/equipment';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Liste d'objets d'un emplacement (armes, sac à dos, objets spéciaux). Les effets connus sont
 * affichés, et les potions ont un bouton « Boire ».
 */
@Component({
  selector: 'lw-item-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ title() }}</h2>
    <ul class="item-list">
      @for (item of rows(); track $index) {
        <li>
          <span>
            {{ item.name }}
            @if (item.hint) {
              <span class="item-effect">{{ item.hint }}</span>
            }
          </span>
          <span class="item-actions">
            @if (item.heal) {
              <button
                type="button"
                class="button button--small"
                [disabled]="!canUse()"
                (click)="used.emit($index)"
              >
                {{ i18n.t('chart.use') }}
              </button>
            }
            <button
              type="button"
              class="icon-button"
              (click)="removed.emit($index)"
              [attr.aria-label]="i18n.t('common.delete') + ' ' + item.name"
            >
              ✕
            </button>
          </span>
        </li>
      }
    </ul>
    @if (full()) {
      <p class="small muted">{{ i18n.t('chart.full') }}</p>
    } @else {
      <form class="item-add" (submit)="add($event)">
        <input
          type="text"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          [placeholder]="i18n.t('chart.newItem')"
          [attr.list]="'known-' + slot()"
          maxlength="60"
          enterkeyhint="done"
        />
        <datalist [id]="'known-' + slot()">
          @for (name of suggestions(); track name) {
            <option [value]="name"></option>
          }
        </datalist>
        <button type="submit" class="button button--small" [disabled]="!draft().trim()">
          {{ i18n.t('common.add') }}
        </button>
      </form>
    }
  `,
})
export class ItemListComponent {
  protected readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly slot = input.required<ItemSlot>();
  readonly items = input.required<string[]>();
  readonly full = input(false);
  /** Les potions ne se boivent pas pendant un combat. */
  readonly canUse = input(true);

  readonly added = output<string>();
  readonly removed = output<number>();
  readonly used = output<number>();

  protected readonly draft = signal('');
  protected readonly suggestions = computed(() => KNOWN_ITEMS[this.slot()]);
  protected readonly rows = computed(() =>
    this.items().map((name) => {
      const effect = itemEffect(name);
      const hints = [
        effect?.endurance ? `+${effect.endurance} ${this.i18n.t('combat.ep')}` : '',
        effect?.combatSkill ? `+${effect.combatSkill} ${this.i18n.t('combat.cs')}` : '',
        effect?.heal ? `+${effect.heal} ${this.i18n.t('combat.ep')}` : '',
      ].filter(Boolean);
      return { name, heal: !!effect?.heal, hint: hints.join(' · ') };
    }),
  );

  protected add(event: Event): void {
    event.preventDefault();
    const value = this.draft().trim();
    if (!value || this.full()) return;
    this.added.emit(value);
    this.draft.set('');
  }
}
