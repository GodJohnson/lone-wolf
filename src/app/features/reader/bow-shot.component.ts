import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { bowShotBonus } from '../../core/game/bow';
import { GameService } from '../../core/game/game.service';
import { randomNumber } from '../../core/game/random';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Tir à l'arc (livre 6) : tire un nombre dans la Table de hasard et y ajoute les bonus d'arc
 * (Weaponmastery avec Bow, Silver Bow of Duadon). Le joueur compare le total aux tranches du texte.
 */
@Component({
  selector: 'lw-bow-shot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card bow-shot" [attr.aria-label]="i18n.t('bow.title')">
      <h2>🏹 {{ i18n.t('bow.title') }}</h2>
      <p class="small muted">{{ i18n.t('bow.hint') }}</p>
      @if (shot(); as s) {
        <p class="archery__picks" aria-live="polite">
          <span class="archery__pick">{{ s.roll }}</span>
          @if (bonus().mastery) {
            + <span class="archery__pick archery__pick--bonus">{{ bonus().mastery }}</span>
            <small>{{ i18n.t('bow.mastery') }}</small>
          }
          @if (bonus().silverBow) {
            + <span class="archery__pick archery__pick--bonus">{{ bonus().silverBow }}</span>
            <small>{{ i18n.t('bow.silver') }}</small>
          }
          = <strong>{{ s.roll + bonus().total }}</strong>
        </p>
      } @else if (bonus().total) {
        <p class="small">
          {{ i18n.t('bow.bonus', { total: bonus().total }) }}
        </p>
      }
      <button type="button" class="button button--block" (click)="shoot()">
        🎲 {{ i18n.t(shot() ? 'bow.again' : 'bow.shoot') }}
      </button>
    </section>
  `,
})
export class BowShotComponent {
  protected readonly i18n = inject(I18nService);
  private readonly game = inject(GameService);
  protected readonly shot = signal<{ roll: number } | null>(null);
  protected readonly bonus = computed(() => {
    const c = this.game.character();
    return c ? bowShotBonus(c) : { mastery: 0, silverBow: 0, total: 0 };
  });

  protected shoot(): void {
    this.shot.set({ roll: randomNumber() });
  }
}
