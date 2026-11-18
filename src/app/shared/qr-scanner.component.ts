import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

/** Lecture d'un QR code avec la caméra (jsQR). Le flux vidéo reste sur l'appareil. */
@Component({
  selector: 'lw-qr-scanner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active()) {
      <div class="scanner">
        <video #video playsinline muted></video>
        <button type="button" class="button" (click)="stop()">{{ i18n.t('common.cancel') }}</button>
      </div>
    } @else {
      <button type="button" class="button button--primary button--block" (click)="start()">
        📷 {{ i18n.t('transfer.scan') }}
      </button>
    }
    @if (error(); as message) {
      <p class="notice notice--error" role="alert">{{ message }}</p>
    }
  `,
})
export class QrScannerComponent implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  readonly scanned = output<string>();
  protected readonly active = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  protected async start(): Promise<void> {
    this.error.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set(this.i18n.t('transfer.noCamera'));
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      this.error.set(this.i18n.t('transfer.cameraDenied'));
      return;
    }
    this.active.set(true);
    // Le <video> n'existe qu'après le rendu.
    await new Promise((resolve) => setTimeout(resolve));
    const video = this.video()?.nativeElement;
    if (!video) return this.stop();
    video.srcObject = this.stream;
    await video.play().catch(() => undefined);

    const mod = await import('jsqr');
    const jsQR = mod.default ?? (mod as unknown as typeof mod.default);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    this.timer = setInterval(() => {
      if (!context || video.videoWidth === 0) return;
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        this.stop();
        this.scanned.emit(code.data);
      }
    }, 200);
  }

  protected stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.active.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
