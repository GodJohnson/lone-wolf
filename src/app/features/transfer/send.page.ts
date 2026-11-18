import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookRepository } from '../../core/book/book-repository';
import { GameState } from '../../core/game/game.models';
import { parseChannelCode, publish } from '../../core/game/relay';
import { TransferError, encodeGame } from '../../core/game/transfer';
import { I18nService } from '../../core/i18n/i18n.service';
import { database } from '../../core/storage/database';
import { TopBarComponent } from '../../shared/top-bar.component';

/** Envoi d'une partie vers un appareil qui affiche un QR code « réception ». */
@Component({
  selector: 'lw-send-page',
  imports: [RouterLink, TopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lw-top-bar [title]="i18n.t('send.title')" [backLink]="['/']" />
    <main class="page">
      @if (!channel()) {
        <p class="notice notice--error">{{ i18n.t('send.invalid') }}</p>
      } @else if (status() === 'sent') {
        <p class="notice">✓ {{ i18n.t('send.sent') }}</p>
        <a class="button button--block" routerLink="/">{{ i18n.t('common.close') }}</a>
      } @else if (games.value(); as list) {
        @if (list.length) {
          <p>{{ i18n.t('send.intro') }}</p>
          <ul class="book-list">
            @for (entry of list; track entry.game.bookId) {
              <li class="card">
                <h2>{{ entry.title }}</h2>
                <p class="small muted">
                  {{
                    i18n.t('transfer.summary', {
                      section: entry.game.section,
                      cs: entry.game.character.combatSkill,
                      ep: entry.game.character.endurance,
                      max: entry.game.character.enduranceMax,
                    })
                  }}
                </p>
                <button
                  type="button"
                  class="button button--primary button--block"
                  [disabled]="status() === 'sending'"
                  (click)="send(entry.game)"
                >
                  {{ status() === 'sending' ? i18n.t('send.sending') : i18n.t('send.button') }}
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="notice">{{ i18n.t('send.none') }}</p>
        }
        @if (error(); as message) {
          <p class="notice notice--error" role="alert">{{ message }}</p>
        }
        <p class="small muted">{{ i18n.t('transfer.relayNote') }}</p>
      } @else {
        <p class="muted center">{{ i18n.t('common.loading') }}</p>
      }
    </main>
  `,
})
export class SendPage {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);

  readonly code = input.required<string>();
  protected readonly channel = computed(() => parseChannelCode(this.code()));
  protected readonly status = signal<'idle' | 'sending' | 'sent'>('idle');
  protected readonly error = signal<string | null>(null);

  protected readonly games = resource({
    loader: async () => {
      const [games, books] = await Promise.all([
        database().then((db) => db.getAll('games')),
        this.books.list(),
      ]);
      return games.map((game) => ({
        game,
        title: books.find((b) => b.id === game.bookId)?.title ?? game.bookId,
      }));
    },
  });

  protected async send(game: GameState): Promise<void> {
    const channel = this.channel();
    if (!channel) return;
    this.error.set(null);
    this.status.set('sending');
    try {
      await publish(channel, encodeGame(game).payload);
      this.status.set('sent');
    } catch (err) {
      this.status.set('idle');
      this.error.set(
        this.i18n.t(
          err instanceof TransferError || (err as Error).message === 'tooBig'
            ? 'transfer.tooBig'
            : 'send.failed',
        ),
      );
    }
  }
}
