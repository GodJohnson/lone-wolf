import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import { BookRepository } from '../core/book/book-repository';

/** Illustration stockée en IndexedDB, affichée via une URL `blob:`. */
@Component({
  selector: 'lw-book-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url.value(); as src) {
      <img [src]="src" alt="" loading="lazy" decoding="async" />
    }
  `,
  host: { class: 'book-image' },
})
export class BookImageComponent {
  private readonly books = inject(BookRepository);
  readonly bookId = input.required<string>();
  readonly name = input.required<string>();

  protected readonly url = resource({
    params: () => ({ bookId: this.bookId(), name: this.name() }),
    loader: ({ params }) => this.books.imageUrl(params.bookId, params.name),
  });
}
