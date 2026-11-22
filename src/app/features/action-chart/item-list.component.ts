import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ItemSlot, KNOWN_ITEMS, itemEffect, itemSize } from '../../core/game/equipment';
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
      @for (item of rows(); track item.name) {
        <li>
          <span>
            {{ item.name }}
            @if (item.count > 1) {
              <strong class="item-count">×{{ item.count }}</strong>
            }
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
                (click)="used.emit(item.first)"
              >
                {{ i18n.t('chart.use') }}
              </button>
            }
            @if (item.buff) {
              <button
                type="button"
                class="button button--small"
                [disabled]="!canBuff()"
                (click)="used.emit(item.first)"
              >
                {{ i18n.t('chart.swallow') }}
              </button>
            }
            <button
              type="button"
              class="icon-button"
              [disabled]="full()"
              (click)="added.emit(item.name)"
              [attr.aria-label]="i18n.t('chart.oneMore') + ' ' + item.name"
            >
              ＋
            </button>
            <button
              type="button"
              class="icon-button"
              (click)="removed.emit(item.last)"
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
  /** Les objets à effet temporaire (baies…) ne s'avalent pas pendant un combat ici : voir le panneau de combat. */
  readonly canBuff = input(true);
  /** Indication supplémentaire par objet (ex. « +2 HAB » pour l'arme maîtrisée). */
  readonly extraHint = input<(name: string) => string>(() => '');

  readonly added = output<string>();
  readonly removed = output<number>();
  readonly used = output<number>();

  protected readonly draft = signal('');
  protected readonly suggestions = computed(() => KNOWN_ITEMS[this.slot()]);
  /** Les exemplaires identiques sont regroupés (« Rope ×2 ») ; chaque ligne agit sur un seul exemplaire. */
  protected readonly rows = computed(() => {
    const groups = new Map<string, { name: string; indexes: number[] }>();
    this.items().forEach((name, index) => {
      const key = name.trim().toLowerCase();
      const group = groups.get(key) ?? { name, indexes: [] };
      group.indexes.push(index);
      groups.set(key, group);
    });
    return [...groups.values()].map(({ name, indexes }) => {
      const effect = itemEffect(name);
      const size = this.slot() === 'backpack' ? itemSize(name) : 1;
      const hints = [
        this.extraHint()(name),
        effect?.endurance ? `+${effect.endurance} ${this.i18n.t('combat.ep')}` : '',
        effect?.combatSkill ? `+${effect.combatSkill} ${this.i18n.t('combat.cs')}` : '',
        effect?.heal ? `+${effect.heal} ${this.i18n.t('combat.ep')}` : '',
        effect?.buff
          ? `+${effect.buff.combatSkill} ${this.i18n.t('combat.cs')} (${this.i18n.t('chart.buffOneCombat')})`
          : '',
        size > 1 ? this.i18n.t('chart.places', { n: size }) : '',
      ].filter(Boolean);
      return {
        name,
        count: indexes.length,
        first: indexes[0],
        last: indexes[indexes.length - 1],
        heal: !!effect?.heal,
        buff: !!effect?.buff,
        hint: hints.join(' · '),
      };
    });
  });

  protected add(event: Event): void {
    event.preventDefault();
    const value = this.draft().trim();
    if (!value || this.full()) return;
    this.added.emit(value);
    this.draft.set('');
  }
}
