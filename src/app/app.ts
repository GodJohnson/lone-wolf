import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateBannerComponent } from './shared/update-banner.component';
import { applyStoredItemSizes } from './core/game/item-sizes';
import { I18nService } from './core/i18n/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet /><lw-update-banner />',
  // L'interface est déjà traduite : seule le texte des livres est proposé à la traduction du navigateur.
  host: { translate: 'no', class: 'notranslate' },
})
export class App {
  // Instancié dès le démarrage pour appliquer la langue au document.
  private readonly i18n = inject(I18nService);

  constructor() {
    applyStoredItemSizes();
  }
}
