import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { GameService } from '../../core/game/game.service';
import { I18nService } from '../../core/i18n/i18n.service';

/** Confirmation d'un choix payant (« pay the driver 3 Gold Crowns and turn to 37 ») avant de débiter l'or. */
@Component({
  selector: 'lw-payment-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()"></div>
    <section
      class="sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="i18n.t('buy.payTitle')"
    >
      <h2>{{ i18n.t('buy.payTitle') }}</h2>
      <p>{{ i18n.t('buy.payQuestion', { price: price(), target: target() }) }}</p>
      <p class="small muted">{{ i18n.t('buy.gold', { gold: gold() }) }}</p>
      @if (!enough()) {
        <p class="notice notice--error" role="alert">
          {{ i18n.t('buy.noGold', { gold: gold(), price: price() }) }}
        </p>
      }
      <div class="sheet__actions">
        <button type="button" class="button" (click)="closed.emit()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="button button--primary"
          [disabled]="!enough()"
          (click)="confirmed.emit()"
        >
          {{ i18n.t('buy.payAction', { price: price() }) }}
        </button>
      </div>
    </section>
  `,
})
export class PaymentSheetComponent {
  protected readonly i18n = inject(I18nService);
  private readonly game = inject(GameService);
  readonly price = input.required<number>();
  readonly target = input.required<number>();
  readonly closed = output<void>();
  readonly confirmed = output<void>();
  protected readonly gold = computed(() => this.game.character()?.gold ?? 0);
  protected readonly enough = computed(() => this.gold() >= this.price());
}
