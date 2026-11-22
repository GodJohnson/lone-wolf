import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { I18nService } from '../core/i18n/i18n.service';

/**
 * Nouvelle version de l'appli : le service worker la télécharge en arrière-plan, mais l'appli ouverte garde
 * l'ancienne jusqu'à un rechargement. Ce bandeau le propose, et la présence d'une mise à jour est
 * vérifiée à chaque retour sur l'appli (une PWA installée reste souvent ouverte en arrière-plan).
 */
@Component({
  selector: 'lw-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <div class="update-banner" role="status">
        <span>{{ i18n.t('update.available') }}</span>
        <button type="button" class="button button--small button--primary" (click)="apply()">
          {{ i18n.t('update.apply') }}
        </button>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  protected readonly i18n = inject(I18nService);
  private readonly sw = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  protected readonly ready = signal(false);

  constructor() {
    if (!this.sw.isEnabled) return;
    const versions = this.sw.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.ready.set(true);
    });
    const check = () => {
      if (this.document.visibilityState === 'visible') this.sw.checkForUpdate().catch(() => {});
    };
    this.document.addEventListener('visibilitychange', check);
    check();
    inject(DestroyRef).onDestroy(() => {
      versions.unsubscribe();
      this.document.removeEventListener('visibilitychange', check);
    });
  }

  protected async apply(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } finally {
      this.document.location.reload();
    }
  }
}
