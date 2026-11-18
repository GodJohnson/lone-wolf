import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BookRepository } from '../../core/book/book-repository';
import { CATALOG, downloadUrl } from '../../core/book/catalog';
import { GameService } from '../../core/game/game.service';
import { GameState } from '../../core/game/game.models';
import { TransferError, decodeGame, extractPayload } from '../../core/game/transfer';
import { I18nService } from '../../core/i18n/i18n.service';
import { MessageKey } from '../../core/i18n/messages';
import { QrScannerComponent } from '../../shared/qr-scanner.component';
import { TopBarComponent } from '../../shared/top-bar.component';

/** Import d'une partie : scan du QR code, lien collé, ou lien ouvert directement. */
@Component({
  selector: 'lw-import-page',
  imports: [RouterLink, TopBarComponent, QrScannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lw-top-bar [title]="i18n.t('transfer.importTitle')" [backLink]="['/']" />
    <main class="page">
      @if (incoming(); as game) {
        <section class="card">
          <h2>{{ bookTitle() }}</h2>
          <p>
            {{
              i18n.t('transfer.summary', {
                section: game.section,
                cs: game.character.combatSkill,
                ep: game.character.endurance,
                max: game.character.enduranceMax,
              })
            }}
          </p>
          <p class="small muted">
            {{ game.character.weapons.join(', ') || '—' }} ·
            {{ game.character.disciplines.join(', ') }}
          </p>
          @if (!bookKnown()) {
            <p class="notice notice--warning">
              {{ i18n.t('transfer.missingBook') }}
              @if (downloadLink(); as link) {
                <a [href]="link" rel="noopener noreferrer">{{ i18n.t('library.download') }}</a>
              }
            </p>
          } @else if (hasGame.value()) {
            <p class="notice notice--warning">{{ i18n.t('transfer.replaces') }}</p>
          }
          <div class="transfer-actions">
            <a class="button" routerLink="/">{{ i18n.t('common.cancel') }}</a>
            <button
              type="button"
              class="button button--primary"
              [disabled]="!bookKnown()"
              (click)="confirm(game)"
            >
              {{ i18n.t('transfer.resume') }}
            </button>
          </div>
        </section>
      } @else {
        <lw-qr-scanner (scanned)="receive($event)" />
        <section class="card">
          <h2>{{ i18n.t('transfer.paste') }}</h2>
          <input
            id="transfer-link"
            type="text"
            inputmode="url"
            [value]="pasted()"
            (input)="pasted.set($any($event.target).value)"
            [placeholder]="i18n.t('transfer.pastePlaceholder')"
            [attr.aria-label]="i18n.t('transfer.paste')"
          />
          <button
            type="button"
            class="button button--block"
            [disabled]="!pasted().trim()"
            (click)="receive(pasted())"
          >
            {{ i18n.t('transfer.read') }}
          </button>
        </section>
        @if (error(); as message) {
          <p class="notice notice--error" role="alert">{{ message }}</p>
        }
        <p class="small muted">{{ i18n.t('transfer.iosHint') }}</p>
      }
    </main>
  `,
})
export class ImportPage {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  /** Données du lien ouvert directement (`#/transfer/<données>`). */
  readonly payload = input<string>();
  protected readonly pasted = signal('');
  private readonly scanError = signal<string | null>(null);
  private readonly scannedPayload = signal<string | null>(null);

  private readonly decoded = computed<{ game: GameState | null; error: string | null }>(() => {
    const raw = this.scannedPayload() ?? this.payload();
    if (!raw) return { game: null, error: null };
    try {
      return { game: decodeGame(raw), error: null };
    } catch (err) {
      return { game: null, error: this.messageFor(err) };
    }
  });
  protected readonly incoming = computed(() => this.decoded().game);
  protected readonly error = computed(() => this.scanError() ?? this.decoded().error);

  private readonly book = resource({
    params: () => this.incoming()?.bookId,
    loader: ({ params }) => this.books.get(params),
  });
  protected readonly hasGame = resource({
    params: () => this.incoming()?.bookId,
    loader: ({ params }) => this.game.exists(params),
  });
  protected readonly bookKnown = computed(() => !!this.book.value());
  protected readonly bookTitle = computed(() => {
    const id = this.incoming()?.bookId;
    return this.book.value()?.title ?? CATALOG.find((c) => c.code === id)?.title ?? id ?? '';
  });
  protected readonly downloadLink = computed(() => {
    const entry = CATALOG.find((c) => c.code === this.incoming()?.bookId);
    return entry ? downloadUrl(entry) : null;
  });

  protected receive(text: string): void {
    this.scanError.set(null);
    const payload = extractPayload(text);
    try {
      decodeGame(payload);
      this.scannedPayload.set(payload);
    } catch (err) {
      this.scanError.set(this.messageFor(err));
    }
  }

  protected async confirm(game: GameState): Promise<void> {
    await this.game.importGame(game);
    await this.router.navigate(['/book', game.bookId, 'play']);
  }

  private messageFor(err: unknown): string {
    const code = err instanceof TransferError ? err.code : 'invalid';
    return this.i18n.t(`transfer.error.${code}` as MessageKey);
  }
}
