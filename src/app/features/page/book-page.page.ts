import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BookRepository } from '../../core/book/book-repository';
import { GameService } from '../../core/game/game.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { BlocksComponent } from '../../shared/blocks.component';
import { RandomNumberComponent } from '../../shared/random-number.component';
import { TopBarComponent } from '../../shared/top-bar.component';
import { useBookLanguage } from '../../shared/book-language';

/** Pages hors sections : règles, disciplines, équipement, carte, histoire... */
@Component({
  selector: 'lw-book-page',
  imports: [RouterLink, TopBarComponent, BlocksComponent, RandomNumberComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lw-top-bar
      [title]="page.value()?.title ?? ''"
      [subtitle]="book.value()?.title ?? ''"
      [backLink]="backLink()"
      [useHistory]="true"
    />
    <main class="page">
      @if (page.value(); as p) {
        <article class="section-text">
          <lw-blocks
            [bookId]="bookId()"
            [blocks]="p.blocks"
            [lang]="book.value()?.lang ?? 'en'"
            (page)="openPage($event)"
          />
        </article>
      } @else if (!page.isLoading()) {
        <p class="notice notice--error">{{ i18n.t('page.notFound') }}</p>
      }

      @if (book.value(); as b) {
        <nav class="card">
          <h2>{{ i18n.t('page.contents') }}</h2>
          <ul class="toc">
            @for (ref of b.pages; track ref.id) {
              <li>
                <a
                  [routerLink]="['/book', b.id, 'page', ref.id]"
                  [class.is-current]="ref.id === pageId()"
                  >{{ ref.title }}</a
                >
              </li>
            }
          </ul>
        </nav>
      }
    </main>
    @if (showRandom()) {
      <lw-random-number (closed)="showRandom.set(false)" />
    }
  `,
})
export class BookPagePage {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly bookId = input.required<string>();
  readonly pageId = input.required<string>();
  protected readonly showRandom = signal(false);

  protected readonly book = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.books.get(params),
  });
  protected readonly page = resource({
    params: () => ({ bookId: this.bookId(), pageId: this.pageId() }),
    loader: ({ params }) => this.books.page(params.bookId, params.pageId),
  });
  private readonly hasGame = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.game.exists(params),
  });
  protected readonly backLink = computed(() =>
    this.hasGame.value() ? ['/book', this.bookId(), 'play'] : ['/'],
  );

  constructor() {
    useBookLanguage(() => this.book.value()?.lang);
    effect(() => {
      if (this.page.value()) window.scrollTo({ top: 0 });
    });
  }

  protected openPage(pageId: string): void {
    if (pageId === 'random') this.showRandom.set(true);
    else if (pageId === 'action' && this.hasGame.value())
      this.router.navigate(['/book', this.bookId(), 'chart']);
    else this.router.navigate(['/book', this.bookId(), 'page', pageId]);
  }
}
