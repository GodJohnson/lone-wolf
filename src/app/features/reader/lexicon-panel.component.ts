import { ChangeDetectionStrategy, Component, inject, input, model, resource } from '@angular/core';
import { BookRepository } from '../../core/book/book-repository';
import { PageRef } from '../../core/book/book.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { BlocksComponent } from '../../shared/blocks.component';

/**
 * Lexique du livre en colonne latérale : les pages de référence (disciplines, équipement, règles de
 * combat, tables…) lues dans le zip importé, consultables sans quitter la section en cours.
 */
@Component({
  selector: 'lw-lexicon-panel',
  imports: [BlocksComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card lexicon">
      <h2>{{ i18n.t('lexicon.title') }}</h2>
      <div class="chips">
        @for (ref of pages(); track ref.id) {
          <button
            type="button"
            class="chip"
            [class.chip--on]="selected() === ref.id"
            [attr.aria-pressed]="selected() === ref.id"
            (click)="toggle(ref.id)"
          >
            {{ ref.title }}
          </button>
        }
      </div>
      @if (selected()) {
        <div class="lexicon__body section-text">
          @if (page.value(); as p) {
            <lw-blocks
              [bookId]="bookId()"
              [blocks]="p.blocks"
              [lang]="lang()"
              (page)="open($event)"
            />
          } @else if (page.isLoading()) {
            <p class="muted">{{ i18n.t('common.loading') }}</p>
          }
        </div>
      } @else {
        <p class="small muted">{{ i18n.t('lexicon.hint') }}</p>
      }
    </section>
  `,
})
export class LexiconPanelComponent {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);

  readonly bookId = input.required<string>();
  readonly pages = input.required<readonly PageRef[]>();
  readonly lang = input('en');
  /** Page consultée ; modifiable de l'extérieur (ex. lien « disciplines » du formulaire). */
  readonly selected = model<string | null>(null);

  protected readonly page = resource({
    params: () => {
      const id = this.selected();
      return id ? { bookId: this.bookId(), id } : undefined;
    },
    loader: ({ params }) => this.books.page(params.bookId, params.id),
  });

  protected toggle(id: string): void {
    this.selected.update((current) => (current === id ? null : id));
  }

  /** Lien interne d'une page de référence vers une autre (ex. « Action Chart »). */
  protected open(id: string): void {
    if (this.pages().some((p) => p.id === id)) this.selected.set(id);
  }
}
