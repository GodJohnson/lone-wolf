import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  CARTWHEEL_CAP,
  CARTWHEEL_SECTION,
  SILVER_TOKEN,
  SILVER_TOKEN_FLAG,
  bankroll,
  cartwheelRound,
  loseStake,
  tokens,
} from '../../core/game/cartwheel';
import { addGold } from '../../core/game/equipment';
import { GameService } from '../../core/game/game.service';
import { randomNumber } from '../../core/game/random';
import { SeriesRules } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';
import { CounterComponent } from '../../shared/counter.component';

interface LogEntry {
  roll: number;
  bet: number;
  stake: number;
  text: string;
  win: boolean;
}

/** Jeu du Cartwheel (livre 2, section 238) : mise, tirage dans la Table de hasard, gains et pertes appliqués. */
@Component({
  selector: 'lw-cartwheel',
  imports: [CounterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card cartwheel" [attr.aria-label]="i18n.t('cartwheel.title')">
      <h2>🎡 {{ i18n.t('cartwheel.title') }}</h2>
      <p class="small muted">{{ i18n.t('cartwheel.weapons') }}</p>
      @if (justGivenToken()) {
        <p class="notice">{{ i18n.t('cartwheel.tokenGiven') }}</p>
      }

      <div class="cartwheel__funds">
        <span>
          🪙 <strong>{{ game.character()?.gold ?? 0 }}</strong>
          @if (tokenCount() > 0) {
            + <span title="{{ i18n.t('cartwheel.tokenHint') }}">🎫 {{ tokenCount() }}</span>
          }
        </span>
        <span class="muted small">{{
          i18n.t('cartwheel.winnings', { won: winnings(), cap: cap })
        }}</span>
      </div>

      <h3 class="small">{{ i18n.t('cartwheel.bet') }}</h3>
      <div class="cartwheel__numbers" role="group" [attr.aria-label]="i18n.t('cartwheel.bet')">
        @for (n of numbers; track n) {
          <button
            type="button"
            class="chip"
            [class.chip--on]="bet() === n"
            [attr.aria-pressed]="bet() === n"
            [disabled]="rolling()"
            (click)="bet.set(n)"
          >
            {{ n }}
          </button>
        }
      </div>

      <h3 class="small">{{ i18n.t('cartwheel.stake') }}</h3>
      <lw-counter [value]="stake()" (delta)="changeStake($event)" />

      <div class="cartwheel__ball" [class.cartwheel__ball--rolling]="rolling()" aria-live="polite">
        {{ display() ?? '–' }}
      </div>

      <button
        type="button"
        class="button button--primary button--block"
        [disabled]="!canPlay()"
        (click)="play()"
      >
        🎲 {{ rolling() ? i18n.t('cartwheel.spinning') : i18n.t('cartwheel.play') }}
      </button>
      @if (hint(); as text) {
        <p class="small muted">{{ text }}</p>
      }

      @if (log().length) {
        <ol class="cartwheel__log small">
          @for (entry of log(); track $index) {
            <li [class.cartwheel__win]="entry.win">{{ entry.text }}</li>
          }
        </ol>
      }

      <div class="cartwheel__exits">
        <button type="button" class="button" (click)="leave.emit(exits.leave)">
          💰 {{ i18n.t('cartwheel.leave', { section: exits.leave }) }}
        </button>
        @if (funds() === 0) {
          <button type="button" class="button button--danger" (click)="leave.emit(exits.ruined)">
            {{ i18n.t('cartwheel.ruined', { section: exits.ruined }) }}
          </button>
        }
      </div>
    </section>
  `,
})
export class CartwheelComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly game = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rules = input.required<SeriesRules>();
  /** Section à ouvrir en quittant la salle (186 : partir, 169 : ruiné). */
  readonly leave = output<number>();

  protected readonly exits = CARTWHEEL_SECTION;
  protected readonly cap = CARTWHEEL_CAP;
  protected readonly numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  protected readonly bet = signal<number | null>(null);
  protected readonly stake = signal(1);
  protected readonly rolling = signal(false);
  protected readonly display = signal<number | null>(null);
  protected readonly winnings = signal(0);
  protected readonly log = signal<LogEntry[]>([]);
  protected readonly justGivenToken = signal(false);

  protected readonly funds = computed(() => {
    const c = this.game.character();
    return c ? bankroll(c) : 0;
  });
  protected readonly tokenCount = computed(() => {
    const c = this.game.character();
    return c ? tokens(c) : 0;
  });
  protected readonly capReached = computed(() => this.winnings() >= CARTWHEEL_CAP);
  protected readonly canPlay = computed(
    () =>
      !this.rolling() &&
      this.bet() !== null &&
      this.stake() >= 1 &&
      this.stake() <= this.funds() &&
      !this.capReached(),
  );
  protected readonly hint = computed(() => {
    if (this.capReached()) return this.i18n.t('cartwheel.capReached', { cap: CARTWHEEL_CAP });
    if (this.funds() === 0) return this.i18n.t('cartwheel.broke');
    if (this.bet() === null) return this.i18n.t('cartwheel.pickBet');
    if (this.stake() > this.funds()) return this.i18n.t('cartwheel.tooHigh');
    return '';
  });

  constructor() {
    // Le jeton d'argent est remis une seule fois par partie, à la première entrée dans la salle.
    effect(() => {
      if (!this.game.character() || this.game.hasFlag(SILVER_TOKEN_FLAG)) return;
      this.game
        .doOnce(SILVER_TOKEN_FLAG, (c) => ({
          ...c,
          specialItems: [...c.specialItems, SILVER_TOKEN],
        }))
        .then((given) => given && this.justGivenToken.set(true));
    });
    // La mise ne dépasse jamais les fonds disponibles.
    effect(() => {
      const funds = this.funds();
      if (this.stake() > Math.max(1, funds)) this.stake.set(Math.max(1, funds));
    });
    this.destroyRef.onDestroy(() => this.timer && clearInterval(this.timer));
  }

  private timer: ReturnType<typeof setInterval> | null = null;

  protected changeStake(delta: number): void {
    this.stake.update((s) => Math.min(Math.max(1, s + delta), Math.max(1, this.funds())));
  }

  protected async play(): Promise<void> {
    const bet = this.bet();
    const stake = this.stake();
    if (bet === null || !this.canPlay()) return;
    this.rolling.set(true);
    const roll = randomNumber();
    // Courte animation de la bille avant de montrer le tirage.
    let ticks = 0;
    await new Promise<void>((resolve) => {
      this.timer = setInterval(() => {
        this.display.set(Math.floor(Math.random() * 10));
        if (++ticks >= 8) {
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
          resolve();
        }
      }, 70);
    });
    this.display.set(roll);

    const round = cartwheelRound(bet, stake, roll, this.winnings());
    const rules = this.rules();
    await this.game.updateCharacter((c) =>
      round.net >= 0 ? addGold(c, round.net, rules) : loseStake(c, stake),
    );
    if (round.net > 0) this.winnings.update((w) => w + round.net);

    const key =
      round.outcome === 'miss'
        ? 'cartwheel.miss'
        : round.outcome === 'exact'
          ? 'cartwheel.exact'
          : 'cartwheel.near';
    const text =
      this.i18n.t(key as 'cartwheel.miss', { roll, net: Math.abs(round.net), stake }) +
      (round.capped ? ' ' + this.i18n.t('cartwheel.capped', { cap: CARTWHEEL_CAP }) : '');
    this.log.update((l) => [{ roll, bet, stake, text, win: round.net > 0 }, ...l].slice(0, 6));
    this.rolling.set(false);
  }
}
