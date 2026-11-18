import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { addGold } from '../../core/game/equipment';
import { GameService } from '../../core/game/game.service';
import { randomNumber } from '../../core/game/random';
import { SAMOR, SamorResult, samorResult } from '../../core/game/samor';
import { SeriesRules, hasDiscipline } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';

/** Samor (livre 2, section 12) : un tirage, puis le gain ou la perte de la mise est appliqué en quittant. */
@Component({
  selector: 'lw-samor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card samor" [attr.aria-label]="i18n.t('samor.title')">
      <h2>♟ {{ i18n.t('samor.title') }}</h2>
      <p class="small muted">{{ i18n.t('samor.rules', { stake: stake }) }}</p>
      @if (sixthSense()) {
        <p class="small">{{ i18n.t('samor.sixthSense') }}</p>
      }
      <div class="cartwheel__ball" aria-live="polite">{{ result() ? result()!.score : '–' }}</div>
      @if (result(); as r) {
        <p>{{ i18n.t(r.net > 0 ? 'samor.win' : r.net < 0 ? 'samor.lose' : 'samor.draw') }}</p>
        <button type="button" class="button button--primary button--block" (click)="leaveNow(r)">
          {{ i18n.t('samor.continue', { section: r.target }) }}
          @if (r.net) {
            ({{ r.net > 0 ? '+' : '−' }}{{ stake }} 🪙)
          }
        </button>
      } @else {
        <button
          type="button"
          class="button button--primary button--block"
          [disabled]="!canPlay()"
          (click)="play()"
        >
          🎲 {{ i18n.t('samor.play') }}
        </button>
        @if (!canPlay()) {
          <p class="small muted">{{ i18n.t('samor.noGold', { stake: stake }) }}</p>
        }
      }
    </section>
  `,
})
export class SamorComponent {
  protected readonly i18n = inject(I18nService);
  private readonly game = inject(GameService);
  readonly rules = input.required<SeriesRules>();
  readonly leave = output<number>();
  protected readonly stake = SAMOR.stake;
  protected readonly result = signal<SamorResult | null>(null);
  protected readonly sixthSense = computed(() => {
    const c = this.game.character();
    return !!c && hasDiscipline(c, 'Sixth Sense');
  });
  protected readonly canPlay = computed(() => (this.game.character()?.gold ?? 0) >= SAMOR.stake);

  protected play(): void {
    this.result.set(samorResult(randomNumber(), this.sixthSense()));
  }

  protected async leaveNow(r: SamorResult): Promise<void> {
    if (r.net) await this.game.updateCharacter((c) => addGold(c, r.net, this.rules()));
    this.leave.emit(r.target);
  }
}
