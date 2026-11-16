import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';

@Component({
  selector: 'lw-top-bar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top-bar">
      @if (backLink(); as link) {
        <a class="icon-button" [routerLink]="link" [attr.aria-label]="i18n.t('common.back')">‹</a>
      }
      <div class="top-bar__title">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <ng-content />
      <button
        type="button"
        class="lang-toggle"
        (click)="i18n.toggle()"
        [attr.aria-label]="i18n.t('app.language')"
      >
        {{ i18n.lang() === 'fr' ? 'EN' : 'FR' }}
      </button>
    </header>
  `,
})
export class TopBarComponent {
  protected readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly backLink = input<string | readonly unknown[] | null>(null);
}
