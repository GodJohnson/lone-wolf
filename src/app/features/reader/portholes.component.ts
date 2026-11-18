import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { addGold } from '../../core/game/equipment';
import { GameService } from '../../core/game/game.service';
import { PORTHOLES, portholesRound } from '../../core/game/portholes';
import { randomNumber } from '../../core/game/random';
import { SeriesRules } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';

type Dice = [number, number];

/** Jeu de dés Portholes (livre 2, section 308) : trois joueurs, deux dés à dix faces chacun. */
@Component({
  selector: 'lw-portholes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card portholes" [attr.aria-label]="i18n.t('portholes.title')">
      <h2>🎲 {{ i18n.t('portholes.title') }}</h2>
      <p class="small muted">
        {{ i18n.t('portholes.rules', { stake: rules0.stake, win: rules0.win }) }}
      </p>
      <p class="portholes__gold">
        🪙 <strong>{{ gold() }}</strong>
      </p>

      <div class="portholes__table">
        @for (player of players(); track player.name) {
          <div class="portholes__player" [class.portholes__player--you]="player.you">
            <span class="portholes__name">{{ player.name }}</span>
            <span class="portholes__dice">
              <span class="portholes__die">{{ player.dice[0] ?? '–' }}</span>
              <span class="portholes__die">{{ player.dice[1] ?? '–' }}</span>
            </span>
            <span class="portholes__total">{{ player.total ?? '' }}</span>
          </div>
        }
      </div>

      @if (result(); as r) {
        <p
          class="portholes__result"
          [class.portholes__result--win]="r.outcome === 'win'"
          aria-live="polite"
        >
          {{ r.text }}
        </p>
      }

      <button
        type="button"
        class="button button--primary button--block"
        [disabled]="!canPlay()"
        (click)="play()"
      >
        🎲
        {{
          rolling()
            ? i18n.t('portholes.rolling')
            : i18n.t('portholes.play', { stake: rules0.stake })
        }}
      </button>
      @if (gold() < rules0.stake) {
        <p class="small muted">{{ i18n.t('portholes.broke', { stake: rules0.stake }) }}</p>
      }

      <div class="portholes__exits">
        <button type="button" class="button" (click)="leave.emit(rules0.exit)">
          🚪 {{ i18n.t('portholes.leave', { section: rules0.exit }) }}
        </button>
      </div>
    </section>
  `,
})
export class PortholesComponent {
  protected readonly i18n = inject(I18nService);
  private readonly game = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rules = input.required<SeriesRules>();
  /** Section à ouvrir en quittant la table (197 : retour à la cabine). */
  readonly leave = output<number>();

  protected readonly rules0 = PORTHOLES;
  protected readonly gold = computed(() => this.game.character()?.gold ?? 0);
  protected readonly rolling = signal(false);
  protected readonly dice = signal<{ a: Dice; b: Dice; you: Dice } | null>(null);
  protected readonly result = signal<{ outcome: 'win' | 'lose' | 'tie'; text: string } | null>(
    null,
  );
  protected readonly canPlay = computed(() => !this.rolling() && this.gold() >= PORTHOLES.stake);

  protected readonly players = computed(() => {
    const d = this.dice();
    const sum = (x?: Dice) => (x ? x[0] + x[1] : null);
    return [
      {
        name: this.i18n.t('portholes.playerA'),
        you: false,
        dice: d?.a ?? [],
        total: this.settled() ? sum(d?.a) : null,
      },
      {
        name: this.i18n.t('portholes.playerB'),
        you: false,
        dice: d?.b ?? [],
        total: this.settled() ? sum(d?.b) : null,
      },
      {
        name: this.i18n.t('portholes.you'),
        you: true,
        dice: d?.you ?? [],
        total: this.settled() ? sum(d?.you) : null,
      },
    ] as { name: string; you: boolean; dice: (number | undefined)[]; total: number | null }[];
  });
  private readonly settled = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.timer && clearInterval(this.timer));
  }

  protected async play(): Promise<void> {
    if (!this.canPlay()) return;
    this.rolling.set(true);
    this.settled.set(false);
    this.result.set(null);
    // Ordre des tirages : joueur A, joueur B, puis vous (deux nombres de la Table de hasard chacun).
    const pair = (): Dice => [randomNumber(), randomNumber()];
    const final = { a: pair(), b: pair(), you: pair() };

    let ticks = 0;
    await new Promise<void>((resolve) => {
      this.timer = setInterval(() => {
        const r = (): Dice => [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)];
        this.dice.set({ a: r(), b: r(), you: r() });
        if (++ticks >= 9) {
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
          resolve();
        }
      }, 70);
    });
    this.dice.set(final);
    this.settled.set(true);

    const round = portholesRound(final.you, final.a, final.b);
    const rules = this.rules();
    if (round.net !== 0) {
      await this.game.updateCharacter((c) =>
        round.net > 0
          ? addGold(c, round.net, rules)
          : { ...c, gold: Math.max(0, c.gold + round.net) },
      );
    }
    const key =
      round.portholes === 'you'
        ? 'portholes.youPortholes'
        : round.portholes === 'other'
          ? 'portholes.otherPortholes'
          : round.outcome === 'win'
            ? 'portholes.win'
            : round.outcome === 'lose'
              ? 'portholes.lose'
              : 'portholes.tie';
    this.result.set({
      outcome: round.outcome,
      text: this.i18n.t(key as 'portholes.win', {
        you: round.totals.you,
        best: Math.max(...round.totals.others),
        net: Math.abs(round.net),
      }),
    });
    this.rolling.set(false);
  }
}
