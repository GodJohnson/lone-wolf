import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { BookRepository } from '../../core/book/book-repository';
import { GameService } from '../../core/game/game.service';
import { encodeGame } from '../../core/game/transfer';
import { I18nService } from '../../core/i18n/i18n.service';
import { TopBarComponent } from '../../shared/top-bar.component';

/** Export d'une partie : QR code + lien à copier ou partager. */
@Component({
  selector: 'lw-transfer-page',
  imports: [TopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lw-top-bar
      [title]="i18n.t('transfer.title')"
      [subtitle]="book.value()?.title ?? ''"
      [backLink]="['/']"
    />
    <main class="page">
      @if (result(); as r) {
        <section class="card transfer-card">
          <p class="small muted center">{{ i18n.t('transfer.scanHint') }}</p>
          @if (qr.value(); as src) {
            <img
              class="transfer-qr"
              [src]="src"
              width="320"
              height="320"
              [alt]="i18n.t('transfer.qrAlt')"
            />
          }
          <div class="transfer-actions">
            <button type="button" class="button button--primary" (click)="copy(r.link)">
              {{ copied() ? '✓ ' + i18n.t('transfer.copied') : i18n.t('transfer.copy') }}
            </button>
            @if (canShare) {
              <button type="button" class="button" (click)="share(r.link)">
                {{ i18n.t('transfer.share') }}
              </button>
            }
          </div>
          @if (r.notesTruncated) {
            <p class="notice notice--warning">{{ i18n.t('transfer.notesTruncated') }}</p>
          }
        </section>
        <p class="notice">{{ i18n.t('transfer.bookNote') }}</p>
      } @else if (error()) {
        <p class="notice notice--error">{{ error() }}</p>
      } @else {
        <p class="muted center">{{ i18n.t('common.loading') }}</p>
      }
    </main>
  `,
})
export class TransferPage {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);
  private readonly game = inject(GameService);

  readonly bookId = input.required<string>();
  protected readonly book = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.books.get(params),
  });
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  private readonly state = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.game.load(params),
  });

  protected readonly result = computed(() => {
    const state = this.state.value();
    if (!state) return null;
    try {
      const { payload, notesTruncated } = encodeGame(state);
      return { link: new URL(`#/transfer/${payload}`, document.baseURI).href, notesTruncated };
    } catch {
      this.error.set(this.i18n.t('transfer.tooBig'));
      return null;
    }
  });

  /** QR généré à la demande (bibliothèque chargée seulement sur cette page). */
  protected readonly qr = resource({
    params: () => this.result()?.link,
    loader: async ({ params }) => {
      // Module CommonJS : selon le bundler, les fonctions sont sur le module ou sur `default`.
      const mod = await import('qrcode');
      const QRCode = mod.default ?? mod;
      return QRCode.toDataURL(params, { errorCorrectionLevel: 'L', margin: 2, width: 320 });
    },
  });

  protected async copy(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set(this.i18n.t('transfer.copyFailed'));
    }
  }

  protected async share(link: string): Promise<void> {
    try {
      await navigator.share({ title: this.i18n.t('app.title'), url: link });
    } catch {
      // Partage annulé par le joueur.
    }
  }
}
