import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Grant, ItemSlot, itemEffect } from '../../core/game/equipment';
import { GameService } from '../../core/game/game.service';
import { FoundItem } from '../../core/game/item-detection';
import { DISCIPLINE, SeriesRules, hasDiscipline, isSkilledWeapon } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';
import { MessageKey } from '../../core/i18n/messages';

/** Confirmation de l'ajout d'un objet trouvé dans le texte : nom et emplacement modifiables. */
@Component({
  selector: 'lw-item-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()"></div>
    <section
      class="sheet item-sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="i18n.t('item.title')"
    >
      <h2>{{ i18n.t('item.title') }}</h2>
      @switch (item().kind) {
        @case ('item') {
          <input
            type="text"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
            maxlength="60"
            [attr.aria-label]="i18n.t('item.name')"
          />
          <div class="chips">
            @for (s of slots; track s) {
              <button
                type="button"
                class="chip"
                [class.chip--on]="slot() === s"
                (click)="slot.set(s)"
              >
                {{ i18n.t(slotLabel(s)) }}
              </button>
            }
          </div>
          @if (effectText(); as text) {
            <p class="item-sheet__effect" [class.item-sheet__effect--good]="skilled()">
              {{ text }}
            </p>
          }
          @if (slot() === 'weapons' && weaponsFull()) {
            <div class="item-sheet__replace">
              <p>{{ i18n.t('item.weaponsFull', { max: rules().maxWeapons }) }}</p>
              <div class="chips">
                @for (w of character()?.weapons ?? []; track $index) {
                  <button type="button" class="chip" (click)="replace($index)">
                    {{ i18n.t('item.replace', { weapon: w }) }}
                  </button>
                }
              </div>
            </div>
          }
        }
        @default {
          <p class="item-sheet__label">{{ summary() }}</p>
        }
      }
      @if (error(); as message) {
        <p class="notice notice--error" role="alert">{{ message }}</p>
      }
      <div class="item-sheet__dismiss">
        <button type="button" class="button button--ghost button--small" (click)="dismissed.emit()">
          {{ i18n.t('item.dismiss') }}
        </button>
        @if (item().kind === 'item') {
          <button
            type="button"
            class="button button--ghost button--small"
            (click)="notAnItem.emit()"
          >
            {{ i18n.t('item.notAnItem') }}
          </button>
        }
      </div>
      <p class="item-sheet__hint">{{ i18n.t('item.dismissHint') }}</p>
      <div class="sheet__actions">
        <button type="button" class="button" (click)="closed.emit()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button type="button" class="button button--primary" [disabled]="!canAdd()" (click)="add()">
          ＋ {{ i18n.t('common.add') }}
        </button>
      </div>
    </section>
  `,
})
export class ItemSheetComponent {
  protected readonly i18n = inject(I18nService);
  private readonly game = inject(GameService);

  readonly item = input.required<FoundItem>();
  readonly rules = input.required<SeriesRules>();
  readonly closed = output<void>();
  /** « Pas ramassable ici » : retirer ce lien dans cette section. */
  readonly dismissed = output<void>();
  /** « Pas un objet » : ce terme ne sera plus jamais un lien, dans aucun livre. */
  readonly notAnItem = output<void>();
  /** Libellé de l'objet ajouté, pour le message de confirmation. */
  readonly added = output<string>();

  protected readonly slots: ItemSlot[] = ['weapons', 'backpack', 'specialItems'];
  protected readonly name = signal('');
  protected readonly slot = signal<ItemSlot>('backpack');
  protected readonly error = signal<string | null>(null);

  protected readonly summary = computed(() => {
    const item = this.item();
    return item.kind === 'item' ? item.name : item.label;
  });
  protected readonly canAdd = computed(
    () =>
      (this.item().kind !== 'item' || !!this.name().trim()) &&
      !(this.item().kind === 'item' && this.slot() === 'weapons' && this.weaponsFull()),
  );

  protected readonly character = this.game.character;
  protected readonly weaponsFull = computed(
    () => (this.character()?.weapons.length ?? 0) >= this.rules().maxWeapons,
  );
  protected readonly skilled = computed(() => {
    const c = this.character();
    return this.slot() === 'weapons' && !!c && isSkilledWeapon(c, this.name());
  });
  /** Effet de l'objet pour ce personnage : bonus d'arme maîtrisée, protection, potion… */
  protected readonly effectText = computed(() => {
    const name = this.name().trim();
    if (!name) return '';
    const c = this.character();
    if (this.slot() === 'weapons') {
      if (this.skilled()) return this.i18n.t('item.effect.skilled');
      const own = c && hasDiscipline(c, DISCIPLINE.weaponskill) ? c.weaponskill : null;
      return own
        ? this.i18n.t('item.effect.plainSkill', { weapon: own })
        : this.i18n.t('item.effect.plain');
    }
    const effect = itemEffect(name);
    if (effect?.endurance) return this.i18n.t('item.effect.endurance', { value: effect.endurance });
    if (effect?.combatSkill)
      return this.i18n.t('item.effect.combatSkill', { value: effect.combatSkill });
    if (effect?.heal) return this.i18n.t('item.effect.heal', { value: effect.heal });
    return '';
  });

  constructor() {
    effect(() => {
      const item = this.item();
      if (item.kind === 'item') {
        this.name.set(item.name);
        this.slot.set(item.slot);
      }
      this.error.set(null);
    });
  }

  protected slotLabel(slot: ItemSlot): MessageKey {
    return `item.slot.${slot}` as MessageKey;
  }

  /** Abandonne une arme portée pour prendre celle-ci. */
  protected async replace(index: number): Promise<void> {
    await this.game.removeItem('weapons', index);
    await this.add();
  }

  protected async add(): Promise<void> {
    const item = this.item();
    const grant: Grant =
      item.kind === 'gold'
        ? { slot: 'gold', amount: item.amount }
        : item.kind === 'meals'
          ? { slot: 'meals', count: item.count }
          : { slot: this.slot(), name: this.name().trim() };
    const error = await this.game.grant(grant, this.rules());
    if (error) {
      this.error.set(this.i18n.t(`chart.error.${error}`));
      return;
    }
    this.added.emit(item.kind === 'item' ? this.name().trim() : item.label);
  }
}
