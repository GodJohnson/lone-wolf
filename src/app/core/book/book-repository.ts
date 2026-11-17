import { Injectable } from '@angular/core';
import { database } from '../storage/database';
import { buildNonItemLexicon } from '../game/item-detection';
import { BookMeta, PageRecord, ParsedBook, SectionRecord } from './book.models';

@Injectable({ providedIn: 'root' })
export class BookRepository {
  private readonly imageUrls = new Map<string, Promise<string | null>>();

  async list(): Promise<BookMeta[]> {
    const books = await (await database()).getAll('books');
    return books.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  }

  async get(bookId: string): Promise<BookMeta | undefined> {
    return (await database()).get('books', bookId);
  }

  async section(bookId: string, number: number): Promise<SectionRecord | undefined> {
    return (await database()).get('sections', [bookId, number]);
  }

  /** Lexique des mots non-objets du livre ; calculé et mémorisé s'il manque (anciens imports). */
  async nonItemWords(bookId: string): Promise<string[]> {
    const db = await database();
    const book = await db.get('books', bookId);
    if (!book) return [];
    if (book.nonItemWords) return book.nonItemWords;
    const sections = await db.getAllFromIndex('sections', 'byBook', bookId);
    const nonItemWords = buildNonItemLexicon(sections, book.disciplines);
    await db.put('books', { ...book, nonItemWords });
    return nonItemWords;
  }

  /** Mémorise qu'un lien d'objet n'est pas ramassable à cet endroit ; retourne la liste à jour. */
  async dismissItem(bookId: string, key: string): Promise<string[]> {
    const db = await database();
    const book = await db.get('books', bookId);
    if (!book) return [];
    const dismissedItems = [...new Set([...(book.dismissedItems ?? []), key])];
    await db.put('books', { ...book, dismissedItems });
    return dismissedItems;
  }

  async page(bookId: string, pageId: string): Promise<PageRecord | undefined> {
    return (await database()).get('pages', [bookId, pageId]);
  }

  /** URL `blob:` d'une illustration du livre, mise en cache pour la session. */
  imageUrl(bookId: string, name: string): Promise<string | null> {
    const key = `${bookId}/${name}`;
    let url = this.imageUrls.get(key);
    if (!url) {
      url = database()
        .then((db) => db.get('images', [bookId, name]))
        .then((record) => (record ? URL.createObjectURL(record.blob) : null));
      this.imageUrls.set(key, url);
    }
    return url;
  }

  /** Remplace intégralement un livre déjà importé (ré-import d'une version corrigée). */
  async save(book: ParsedBook): Promise<void> {
    // Les corrections du joueur survivent à un réimport.
    const previous = await this.get(book.meta.id);
    if (previous?.dismissedItems)
      book = { ...book, meta: { ...book.meta, dismissedItems: previous.dismissedItems } };
    await this.removeContent(book.meta.id);
    const db = await database();
    const tx = db.transaction(['books', 'sections', 'pages', 'images'], 'readwrite');
    await Promise.all([
      tx.objectStore('books').put(book.meta),
      ...book.sections.map((s) => tx.objectStore('sections').put(s)),
      ...book.pages.map((p) => tx.objectStore('pages').put(p)),
      ...book.images.map((i) => tx.objectStore('images').put(i)),
      tx.done,
    ]);
  }

  /** Supprime le livre et la partie associée. */
  async remove(bookId: string): Promise<void> {
    await this.removeContent(bookId);
    await (await database()).delete('games', bookId);
  }

  private async removeContent(bookId: string): Promise<void> {
    const db = await database();
    const tx = db.transaction(['books', 'sections', 'pages', 'images'], 'readwrite');
    const range = IDBKeyRange.only(bookId);
    const deleteByBook = async (store: 'sections' | 'pages' | 'images') => {
      let cursor = await tx.objectStore(store).index('byBook').openCursor(range);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    };
    await Promise.all([
      tx.objectStore('books').delete(bookId),
      deleteByBook('sections'),
      deleteByBook('pages'),
      deleteByBook('images'),
      tx.done,
    ]);
    for (const [key, url] of this.imageUrls) {
      if (key.startsWith(`${bookId}/`)) {
        url.then((u) => u && URL.revokeObjectURL(u));
        this.imageUrls.delete(key);
      }
    }
  }
}
