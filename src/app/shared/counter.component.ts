import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

/**
 * Compteur de la Feuille d'aventure : −1 / +1, et un montant libre (« ± ») pour les gros changements
 * du récit (« vous perdez toutes vos couronnes », « vous trouvez 25 couronnes »).
 */
@Component({
  selector: 'lw-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stepper">
      <button type="button" class="icon-button" (click)="delta.emit(-1)" aria-label="-1">−</button>
      <span class="stat__value" [class.danger]="danger()">{{ value() }}</span>
      <button type="button" class="icon-button" (click)="delta.emit(1)" aria-label="+1">+</button>
      <button
        type="button"
        class="icon-button amount-toggle"
        [class.amount-toggle--on]="open()"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="i18n.t('counter.amount')"
        (click)="open.set(!open())"
      >
        ±
      </button>
    </div>
    @if (open()) {
      <form class="amount-row" (submit)="$event.preventDefault()">
        <input
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          [value]="amount()"
          (input)="amount.set($any($event.target).value)"
          [placeholder]="i18n.t('counter.placeholder')"
          [attr.aria-label]="i18n.t('counter.amount')"
        />
        <button
          type="button"
          class="button button--small"
          [disabled]="!parsed()"
          (click)="apply(-1)"
        >
          − {{ i18n.t('counter.remove') }}
        </button>
        <button
          type="button"
          class="button button--small"
          [disabled]="!parsed()"
          (click)="apply(1)"
        >
          + {{ i18n.t('counter.add') }}
        </button>
        @if (clearable()) {
          <button
            type="button"
            class="button button--small"
            [disabled]="value() === 0"
            (click)="clear.emit()"
          >
            {{ i18n.t('counter.all') }}
          </button>
        }
      </form>
    }
  `,
})
export class CounterComponent {
  protected readonly i18n = inject(I18nService);
  readonly value = input.required<number>();
  readonly danger = input(false);
  /** Propose « Tout retirer » (ex. l'or). */
  readonly clearable = input(false);
  readonly delta = output<number>();
  readonly clear = output<void>();

  protected readonly open = signal(false);
  protected readonly amount = signal('');
  /** Montant saisi : entier de 1 à 999, sinon `null`. */
  protected readonly parsed = computed(() => {
    const n = Number(this.amount());
    return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null;
  });

  protected apply(sign: 1 | -1): void {
    const n = this.parsed();
    if (n === null) return;
    this.delta.emit(sign * n);
    this.amount.set('');
  }
}
