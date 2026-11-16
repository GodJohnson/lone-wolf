import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { randomNumber } from '../core/game/random';

/** Table de hasard : remplace le tirage « crayon les yeux fermés » du livre papier. */
@Component({
  selector: 'lw-random-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()"></div>
    <section
      class="sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="i18n.t('random.title')"
    >
      <h2>{{ i18n.t('random.title') }}</h2>
      <output class="random-result" [class.random-result--rolling]="rolling()" aria-live="polite">
        {{ value() ?? '–' }}
      </output>
      <div class="sheet__actions">
        <button type="button" class="button" (click)="closed.emit()">
          {{ i18n.t('common.close') }}
        </button>
        <button
          type="button"
          class="button button--primary"
          (click)="draw()"
          [disabled]="rolling()"
        >
          🎲 {{ i18n.t('random.draw') }}
        </button>
      </div>
    </section>
  `,
})
export class RandomNumberComponent {
  protected readonly i18n = inject(I18nService);
  readonly closed = output<void>();
  protected readonly value = signal<number | null>(null);
  protected readonly rolling = signal(false);

  protected draw(): void {
    this.rolling.set(true);
    // Courte animation : le joueur voit qu'un nouveau tirage a eu lieu même si le chiffre est identique.
    let ticks = 0;
    const timer = setInterval(() => {
      this.value.set(randomNumber());
      if (++ticks >= 6) {
        clearInterval(timer);
        this.value.set(randomNumber());
        this.rolling.set(false);
      }
    }, 60);
  }
}
