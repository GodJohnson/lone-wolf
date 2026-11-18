import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  output,
  resource,
  signal,
} from '@angular/core';
import { channelCode, newChannel, subscribe } from '../../core/game/relay';
import { I18nService } from '../../core/i18n/i18n.service';
import { qrDataUrl } from '../../shared/qr';

const WAIT_MS = 10 * 60 * 1000;

/** Réception sans caméra : affiche un QR code que l'autre appareil scanne pour envoyer sa partie. */
@Component({
  selector: 'lw-receive-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link(); as value) {
      <section class="card transfer-card">
        <h2>{{ i18n.t('transfer.receiveWaiting') }}</h2>
        @if (qr.value(); as src) {
          <img
            class="transfer-qr"
            [src]="src"
            width="320"
            height="320"
            [alt]="i18n.t('transfer.qrAlt')"
          />
        }
        <p class="small muted center">{{ i18n.t('transfer.receiveHint') }}</p>
        <div class="transfer-actions">
          <button type="button" class="button" (click)="copy(value)">
            {{ copied() ? '✓ ' + i18n.t('transfer.copied') : i18n.t('transfer.copy') }}
          </button>
          <button type="button" class="button button--ghost" (click)="stop()">
            {{ i18n.t('common.cancel') }}
          </button>
        </div>
        <p class="small muted center">{{ i18n.t('transfer.relayNote') }}</p>
      </section>
    } @else {
      <button type="button" class="button button--block" (click)="start()">
        ⇄ {{ i18n.t('transfer.receive') }}
      </button>
    }
    @if (error(); as message) {
      <p class="notice notice--error" role="alert">{{ message }}</p>
    }
  `,
})
export class ReceivePanelComponent implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  /** Partie reçue (données déjà déchiffrées, encore à valider). */
  readonly received = output<string>();

  protected readonly link = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly qr = resource({
    params: () => this.link() ?? undefined,
    loader: ({ params }) => qrDataUrl(params),
  });
  private stopListening: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected start(): void {
    this.error.set(null);
    const channel = newChannel();
    this.link.set(new URL(`#/send/${channelCode(channel)}`, document.baseURI).href);
    this.stopListening = subscribe(
      channel,
      (plaintext) => {
        this.stop();
        this.received.emit(plaintext);
      },
      () => {
        this.stop();
        this.error.set(this.i18n.t('transfer.relayDown'));
      },
    );
    this.timer = setTimeout(() => {
      this.stop();
      this.error.set(this.i18n.t('transfer.receiveTimeout'));
    }, WAIT_MS);
  }

  protected stop(): void {
    this.stopListening?.();
    this.stopListening = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.link.set(null);
  }

  protected async copy(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set(this.i18n.t('transfer.copyFailed'));
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
