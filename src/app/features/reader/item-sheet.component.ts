import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Grant, ItemSlot, itemEffect, itemSize } from '../../core/game/equipment';
import { setItemSize } from '../../core/game/item-sizes';
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
    @if (!inline()) {
      <div class="sheet-backdrop" (click)="closed.emit()"></div>
    }
    <section
      class="item-sheet"
      [class.sheet]="!inline()"
      [class.card]="inline()"
      [attr.role]="inline() ? null : 'dialog'"
      [attr.aria-modal]="inline() ? null : true"
      [attr.aria-label]="i18n.t('item.title')"
    >
      <h2>
        {{ i18n.t(isPurchase() ? 'buy.title' : isEndurance() ? 'endurance.title' : 'item.title') }}
      </h2>
      @if (isPurchase()) {
        <label class="item-sheet__price">
          {{ i18n.t('buy.price') }}
          <input
            type="number"
            inputmode="numeric"
            min="1"
            max="999"
            [value]="price()"
            (input)="price.set(+$any($event.target).value)"
          />
        </label>
        <p class="small muted">{{ i18n.t('buy.gold', { gold: character()?.gold ?? 0 }) }}</p>
        <label class="item-sheet__just-pay">
          <input
            type="checkbox"
            [checked]="justPay()"
            (change)="justPay.set($any($event.target).checked)"
          />
          {{ i18n.t('buy.justPay') }}
        </label>
        @if (!enoughGold()) {
          <p class="notice notice--error" role="alert">
            {{ i18n.t('buy.noGold', { gold: character()?.gold ?? 0, price: totalPrice() }) }}
          </p>
        }
      }
      @if (isEndurance()) {
        <label class="item-sheet__price">
          {{ i18n.t('endurance.amount') }}
          <input
            type="number"
            inputmode="numeric"
            min="-99"
            max="99"
            [value]="amount()"
            (input)="amount.set(+$any($event.target).value)"
          />
        </label>
      }
      @switch (hasItemFields() ? 'fields' : item().kind) {
        @case ('fields') {
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
          @if (slot() === 'backpack') {
            <label class="item-sheet__price">
              {{ i18n.t('item.size') }}
              <input
                type="number"
                inputmode="numeric"
                min="1"
                max="8"
                [value]="size()"
                (input)="size.set(+$any($event.target).value)"
              />
            </label>
          }
          <label class="item-sheet__price">
            {{ i18n.t('item.quantity') }}
            <input
              type="number"
              inputmode="numeric"
              min="1"
              max="9"
              [value]="quantity()"
              (input)="quantity.set(Math.max(1, Math.min(9, +$any($event.target).value || 1)))"
            />
          </label>
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
        @case ('purchase') {}
        @default {
          <p class="item-sheet__label">{{ summary() }}</p>
        }
      }
      @if (error(); as message) {
        <p class="notice notice--error" role="alert">{{ message }}</p>
      }
      @if (!isDeclared()) {
        <div class="item-sheet__dismiss">
          <button
            type="button"
            class="button button--ghost button--small"
            (click)="dismissed.emit()"
          >
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
      } @else {
        <p class="item-sheet__hint">
          {{
            i18n.t(
              !declareLinkable()
                ? 'declare.hintTranslated'
                : isPurchase()
                  ? 'buy.declareHint'
                  : 'declare.hint'
            )
          }}
        </p>
      }
      <div class="sheet__actions">
        <button type="button" class="button" (click)="closed.emit()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button type="button" class="button button--primary" [disabled]="!canAdd()" (click)="add()">
          @if (isPurchase()) {
            {{ i18n.t(justPay() ? 'buy.payAction' : 'buy.action', { price: totalPrice() }) }}
          } @else if (isEndurance()) {
            {{ i18n.t('endurance.apply') }}
          } @else {
            ＋ {{ i18n.t('common.add') }}
          }
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
  /** Mode bureau : intégré à la colonne latérale, sans voile ni feuille flottante. */
  readonly inline = input(false);
  /** Objet déclaré à la main : le lien peut être mémorisé (faux si le texte affiché est traduit). */
  readonly declareLinkable = input(true);
  readonly closed = output<void>();
  /** « Pas ramassable ici » : retirer ce lien dans cette section. */
  readonly dismissed = output<void>();
  /** « Pas un objet » : ce terme ne sera plus jamais un lien, dans aucun livre. */
  readonly notAnItem = output<void>();
  /** Libellé de l'objet ajouté, pour le message de confirmation. */
  readonly added = output<string>();
  /** Achat effectué : message de confirmation, nom et prix (pour mémoriser un achat déclaré). */
  readonly bought = output<{ message: string; name: string; price: number }>();

  protected readonly slots: ItemSlot[] = ['weapons', 'backpack', 'specialItems'];
  protected readonly isDeclared = computed(() => {
    const item = this.item();
    return (
      (item.kind === 'item' || item.kind === 'purchase' || item.kind === 'endurance') &&
      !!item.declared
    );
  });
  protected readonly isPurchase = computed(() => this.item().kind === 'purchase');
  protected readonly isEndurance = computed(() => this.item().kind === 'endurance');
  /** Montant signé d'ENDURANCE (négatif = perte), modifiable avant d'appliquer. */
  protected readonly amount = signal(0);
  protected readonly Math = Math;
  protected readonly price = signal(0);
  /** Achat d'un service (chambre, boisson…) : seul l'or est débité. */
  protected readonly justPay = signal(false);
  /** Nombre d'exemplaires achetés ou ajoutés d'un coup. */
  protected readonly quantity = signal(1);
  /** Places que l'objet prend dans le sac à dos. */
  protected readonly size = signal(1);
  protected readonly totalPrice = computed(
    () => this.price() * (this.justPay() ? 1 : this.quantity()),
  );
  protected readonly enoughGold = computed(
    () => (this.character()?.gold ?? 0) >= this.totalPrice(),
  );
  /** Nom et emplacement modifiables : objets trouvés et achats d'objet. */
  protected readonly hasItemFields = computed(() => {
    const kind = this.item().kind;
    return kind === 'item' || (kind === 'purchase' && !this.justPay());
  });
  protected readonly name = signal('');
  protected readonly slot = signal<ItemSlot>('backpack');
  protected readonly error = signal<string | null>(null);

  protected readonly summary = computed(() => {
    const item = this.item();
    if (item.kind === 'endurance') {
      const amount = this.amount();
      return this.i18n.t(amount < 0 ? 'endurance.lose' : 'endurance.gain', {
        n: Math.abs(amount),
      });
    }
    return 'label' in item ? item.label : item.name;
  });
  protected readonly canAdd = computed(() => {
    if (this.isEndurance()) return this.amount() !== 0;
    if (this.isPurchase()) {
      const price = this.price();
      if (!(price >= 1) || !this.enoughGold() || !(this.quantity() >= 1)) return false;
      if (this.justPay()) return true;
    }
    return (
      (!this.hasItemFields() || !!this.name().trim()) &&
      !(this.hasItemFields() && this.slot() === 'weapons' && this.weaponsFull())
    );
  });

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
      if (item.kind === 'item' || item.kind === 'purchase') {
        this.name.set(item.name);
        this.slot.set(item.slot);
      }
      if (item.kind === 'purchase') this.price.set(item.price);
      if (item.kind === 'endurance') this.amount.set(item.amount);
      this.justPay.set(false);
      this.quantity.set(1);
      this.error.set(null);
    });
    // Taille de départ d'un objet : celle du livre (corde = 2 places), modifiable pour ce nom.
    effect(() => {
      const name = this.name();
      untracked(() => this.size.set(itemSize(name)));
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
    if (item.kind === 'purchase') return this.buy();
    if (item.kind === 'endurance') return this.applyEndurance(this.amount());
    if (item.kind === 'item') this.rememberSize();
    const grant: Grant | Grant[] =
      item.kind === 'gold'
        ? { slot: 'gold', amount: item.amount }
        : item.kind === 'meals'
          ? { slot: 'meals', count: item.count }
          : this.copies({ slot: this.slot(), name: this.name().trim() });
    const error = await this.game.grant(grant, this.rules());
    if (error) {
      this.error.set(this.i18n.t(`chart.error.${error}`));
      return;
    }
    this.added.emit(
      item.kind === 'item' ? this.name().trim() : 'label' in item ? item.label : item.name,
    );
  }

  /** La même ligne d'inventaire en `quantity` exemplaires. */
  private copies(grant: Grant): Grant[] {
    return Array.from({ length: this.quantity() }, () => grant);
  }

  /** Une taille de sac différente de celle du livre est mémorisée pour ce nom d'objet. */
  private rememberSize(): void {
    if (this.slot() === 'backpack') setItemSize(this.name(), this.size());
  }

  /** Perte ou gain d'ENDURANCE du récit, borné entre 0 et le total. */
  private async applyEndurance(amount: number): Promise<void> {
    await this.game.updateCharacter((c) => ({
      ...c,
      endurance: Math.min(c.enduranceMax, Math.max(0, c.endurance + amount)),
    }));
    this.bought.emit({ message: this.summary(), name: this.summary(), price: amount });
  }

  private async buy(): Promise<void> {
    const price = this.price();
    const name = this.name().trim();
    const qty = this.justPay() ? 1 : this.quantity();
    if (!this.justPay()) this.rememberSize();
    const grant = this.justPay() ? null : this.copies({ slot: this.slot(), name });
    const error = await this.game.buy(price * qty, grant, this.rules());
    if (error === 'noGold') return;
    if (error) {
      this.error.set(this.i18n.t(`chart.error.${error}`));
      return;
    }
    this.bought.emit({
      message: this.justPay()
        ? this.i18n.t('buy.paid', { price })
        : this.i18n.t('buy.done', { item: qty > 1 ? `${name} ×${qty}` : name, price: price * qty }),
      name: this.justPay() ? this.summary() : name,
      price,
    });
  }
}
