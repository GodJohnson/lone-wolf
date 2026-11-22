import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookImportError, importBookZip } from '../../core/book/book-importer';
import { BookRepository } from '../../core/book/book-repository';
import { BookMeta, PARSER_VERSION } from '../../core/book/book.models';
import { CATALOG, PROJECT_AON_LICENSE_URL, downloadUrl } from '../../core/book/catalog';
import { nextBookNumber } from '../../core/game/carry-over';
import { SERIES_RULES } from '../../core/game/rules';
import { database } from '../../core/storage/database';
import { I18nService } from '../../core/i18n/i18n.service';
import { MessageKey } from '../../core/i18n/messages';
import { TopBarComponent } from '../../shared/top-bar.component';

interface LibraryEntry {
  book: BookMeta;
  savedSection: number | null;
  finished: boolean;
  /** Livre analysé avec une ancienne version : du texte peut manquer, un réimport le corrige. */
  outdated: boolean;
  /** Livre suivant de la série Kaï (importé ou non), pour reprendre le héros. */
  next: { number: number; title: string; code: string; imported: boolean } | null;
}

@Component({
  selector: 'lw-library-page',
  imports: [RouterLink, TopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './library.page.html',
})
export class LibraryPage {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);

  protected readonly licenseUrl = PROJECT_AON_LICENSE_URL;
  protected readonly importing = signal(false);
  protected readonly message = signal<{ text: string; error: boolean } | null>(null);

  protected readonly library = resource({
    loader: async (): Promise<LibraryEntry[]> => {
      const [books, games] = await Promise.all([
        this.books.list(),
        database().then((db) => db.getAll('games')),
      ]);
      return books.map((book) => {
        const nextNumber = nextBookNumber(
          book.number,
          book.series === 'kai' || book.series === 'magnakai' ? SERIES_RULES[book.series] : null,
        );
        const nextEntry = CATALOG.find((c) => c.number === nextNumber);
        return {
          book,
          savedSection: games.find((g) => g.bookId === book.id)?.section ?? null,
          outdated: (book.parserVersion ?? 1) < PARSER_VERSION,
          finished: games.find((g) => g.bookId === book.id)?.finished ?? false,
          next: nextEntry
            ? { ...nextEntry, imported: books.some((b) => b.id === nextEntry.code) }
            : null,
        };
      });
    },
  });

  /** Lien de téléchargement officiel du zip d'un livre (par code Project Aon). */
  protected nextUrl(code: string): string {
    const entry = CATALOG.find((c) => c.code === code);
    return entry ? downloadUrl(entry) : '#';
  }

  protected readonly catalog = computed(() => {
    const imported = new Set((this.library.value() ?? []).map((e) => e.book.id));
    return CATALOG.map((entry) => ({
      ...entry,
      url: downloadUrl(entry),
      imported: imported.has(entry.code),
    }));
  });

  protected seriesLabel(book: BookMeta): string {
    return book.series ? this.i18n.t(`library.series.${book.series}` as MessageKey) : '';
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.importing.set(true);
    this.message.set(null);
    try {
      const parsed = await importBookZip(file);
      await this.books.save(parsed);
      this.message.set({
        text: this.i18n.t('library.imported', { title: parsed.meta.title }),
        error: false,
      });
      this.library.reload();
    } catch (err) {
      const text =
        err instanceof BookImportError
          ? this.i18n.t(`import.error.${err.code}` as MessageKey)
          : this.i18n.t('import.error.unknown', {
              message: err instanceof Error ? err.message : String(err),
            });
      this.message.set({ text, error: true });
    } finally {
      this.importing.set(false);
    }
  }

  protected async remove(book: BookMeta): Promise<void> {
    if (!confirm(this.i18n.t('library.deleteConfirm', { title: book.title }))) return;
    await this.books.remove(book.id);
    this.library.reload();
  }
}
