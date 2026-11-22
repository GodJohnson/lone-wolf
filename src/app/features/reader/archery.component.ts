import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  ARCHERY,
  FINAL_START,
  FinalRound,
  Qualification,
  finalRound,
  qualification,
} from '../../core/game/archery';
import { GameService } from '../../core/game/game.service';
import { randomNumber } from '../../core/game/random';
import { effectiveCombatSkill, isSkilledWeapon } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';
import { MessageKey } from '../../core/i18n/messages';

/**
 * Tournoi d'archerie (livre 6) : qualification (§340, trois tirages) et finale contre Altan (§26, combat
 * dont les pertes se déduisent de 50 points de CIBLE au lieu de l'ENDURANCE).
 */
@Component({
  selector: 'lw-archery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card archery" [attr.aria-label]="i18n.t('archery.title')">
      <h2>🏹 {{ i18n.t(mode() === 'final' ? 'archery.finalTitle' : 'archery.qualifyTitle') }}</h2>
      <p class="small muted">
        {{
          mode() === 'final'
            ? i18n.t('archery.finalRules', { points: target })
            : i18n.t('archery.qualifyRules', { needed: needed })
        }}
      </p>
      <label class="toggle">
        <input
          type="checkbox"
          [checked]="jakan()"
          [disabled]="started()"
          (change)="jakan.set($any($event.target).checked)"
        />
        {{ i18n.t('archery.jakan') }}
      </label>

      @if (mode() === 'qualify') {
        @if (qualified(); as q) {
          <p class="archery__picks" aria-live="polite">
            @for (n of q.picks; track $index) {
              <span class="archery__pick">{{ n }}</span>
              @if (!$last) {
                +
              }
            }
            @if (q.bonus) {
              + <span class="archery__pick archery__pick--bonus">{{ q.bonus }}</span>
            }
            = <strong>{{ q.total }}</strong>
          </p>
          <p>{{ i18n.t(q.qualified ? 'archery.qualified' : 'archery.eliminated') }}</p>
          @if (q.jakanBroke) {
            <p class="notice notice--warning">{{ i18n.t('archery.jakanBrokeQualify') }}</p>
          }
          <button
            type="button"
            class="button button--primary button--block"
            (click)="leave.emit(exitQualify())"
          >
            {{ i18n.t('archery.continue', { section: exitQualify() }) }}
          </button>
        } @else {
          @if (bowMastery()) {
            <p class="small">{{ i18n.t('archery.bowMastery', { bonus: bonus }) }}</p>
          }
          <button type="button" class="button button--primary button--block" (click)="shoot()">
            🏹 {{ i18n.t('archery.shoot') }}
          </button>
        }
      } @else {
        <div class="archery__bars">
          <label>
            {{ i18n.t('archery.you') }} {{ state().player }}/{{ target }}
            <progress [value]="state().player" [max]="target"></progress>
          </label>
          <label>
            Altan {{ state().enemy }}/{{ target }}
            <progress [value]="state().enemy" [max]="target"></progress>
          </label>
        </div>
        <p class="small muted">
          {{
            i18n.t('archery.cs', {
              mine: combatSkill(),
              altan: altanCs,
              ratio: combatSkill() - altanCs,
            })
          }}
        </p>
        @if (!finished()) {
          <button type="button" class="button button--primary button--block" (click)="round()">
            🏹 {{ i18n.t('archery.round') }}
          </button>
        }
        @if (rounds().length) {
          <ol class="archery__log small">
            @for (r of rounds(); track $index) {
              <li>
                {{
                  i18n.t('archery.logLine', { roll: r.roll, you: r.playerLoss, altan: r.enemyLoss })
                }}
              </li>
            }
          </ol>
        }
        @if (outcome(); as o) {
          <p aria-live="polite">{{ i18n.t(outcomeKey(o)) }}</p>
          <button
            type="button"
            class="button button--primary button--block"
            (click)="leave.emit(exitFinal())"
          >
            {{ i18n.t('archery.continue', { section: exitFinal() }) }}
          </button>
        }
        <p class="small muted">{{ i18n.t('archery.noArrows') }}</p>
      }
    </section>
  `,
})
export class ArcheryComponent {
  protected readonly i18n = inject(I18nService);
  private readonly game = inject(GameService);

  /** `qualify` (§340) ou `final` (§26). */
  readonly mode = input.required<'qualify' | 'final'>();
  readonly leave = output<number>();

  protected readonly target = ARCHERY.targetPoints;
  protected readonly altanCs = ARCHERY.altanCombatSkill;
  protected readonly needed = ARCHERY.qualifyingScore;
  protected readonly bonus = ARCHERY.bowMasteryBonus;
  protected readonly jakan = signal(false);
  protected readonly qualified = signal<Qualification | null>(null);
  protected readonly state = signal(FINAL_START);
  protected readonly rounds = signal<FinalRound[]>([]);
  protected readonly outcome = signal<'won' | 'lost' | 'broken' | null>(null);

  protected readonly started = computed(() => !!this.qualified() || this.rounds().length > 0);
  protected readonly finished = computed(() => !!this.outcome());

  /** Weaponmastery avec Bow (+3 à la qualification et en finale). */
  protected readonly bowMastery = computed(() => {
    const c = this.game.character();
    return !!c && isSkilledWeapon(c, 'Bow');
  });

  /** HABILETÉ pour la finale : arc seul en main (arc prêté compris), Sommerswerd laissé de côté. */
  protected readonly combatSkill = computed(() => {
    const c = this.game.character();
    if (!c) return 0;
    const archer = {
      ...c,
      weapons: ['Bow'],
      specialItems: c.specialItems.filter((i) => !/sommerswerd/i.test(i)),
    };
    return effectiveCombatSkill(archer, {
      modifier: this.jakan() ? -ARCHERY.jakanPenalty : 0,
      useMindblast: false,
    }).total;
  });

  protected readonly exitQualify = computed(() =>
    this.qualified()?.qualified ? ARCHERY.final : ARCHERY.eliminated,
  );
  protected readonly exitFinal = computed(() => {
    const o = this.outcome();
    return o === 'won' ? ARCHERY.finalWon : o === 'broken' ? ARCHERY.jakanBroke : ARCHERY.finalLost;
  });

  protected outcomeKey(o: 'won' | 'lost' | 'broken'): MessageKey {
    return o === 'won'
      ? 'archery.outcome.won'
      : o === 'broken'
        ? 'archery.outcome.broken'
        : 'archery.outcome.lost';
  }

  protected shoot(): void {
    const picks = [randomNumber(), randomNumber(), randomNumber()];
    this.qualified.set(qualification(picks, this.bowMastery(), this.jakan()));
  }

  protected round(): void {
    if (this.finished()) return;
    const r = finalRound(this.state(), this.combatSkill(), randomNumber(), this.jakan());
    this.state.set(r.state);
    this.rounds.update((list) => [...list, r]);
    if (r.outcome !== 'ongoing') this.outcome.set(r.outcome);
  }
}
