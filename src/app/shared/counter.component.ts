import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

/**
 * Compteur de la Feuille d'aventure : −10 −1 [valeur] +1 +10. La valeur se tape aussi à la main
 * (taper 0 remet l'or à zéro), pour les gros changements du récit.
 */
@Component({
  selector: 'lw-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="counter">
      <button
        type="button"
        class="counter__btn counter__btn--big"
        (click)="delta.emit(-10)"
        aria-label="-10"
      >
        −10
      </button>
      <button type="button" class="counter__btn" (click)="delta.emit(-1)" aria-label="-1">
        −1
      </button>
      <input
        class="counter__value"
        type="number"
        inputmode="numeric"
        min="0"
        step="1"
        [class.danger]="danger()"
        [value]="value()"
        [attr.aria-label]="i18n.t('counter.amount')"
        (change)="set($event)"
        (focus)="select($event)"
      />
      <button type="button" class="counter__btn" (click)="delta.emit(1)" aria-label="+1">+1</button>
      <button
        type="button"
        class="counter__btn counter__btn--big"
        (click)="delta.emit(10)"
        aria-label="+10"
      >
        +10
      </button>
    </div>
  `,
})
export class CounterComponent {
  protected readonly i18n = inject(I18nService);
  readonly value = input.required<number>();
  readonly danger = input(false);
  /** Variation demandée (négative ou positive). */
  readonly delta = output<number>();

  protected set(event: Event): void {
    const field = event.target as HTMLInputElement;
    const typed = Number(field.value);
    if (field.value.trim() === '' || !Number.isInteger(typed) || typed < 0 || typed > 999) {
      field.value = String(this.value()); // saisie invalide : on revient à la valeur actuelle
      return;
    }
    if (typed !== this.value()) this.delta.emit(typed - this.value());
  }

  protected select(event: Event): void {
    (event.target as HTMLInputElement).select();
  }
}
