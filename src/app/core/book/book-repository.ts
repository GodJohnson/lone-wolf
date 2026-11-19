import { Injectable } from '@angular/core';
import { database } from '../storage/database';
import { buildNonItemLexicon } from '../game/item-detection';
import { BookMeta, PageRecord, ParsedBook, SectionRecord } from './book.models';

const USER_NON_ITEMS_KEY = 'lone-wolf.nonItems';

/** Listes de corrections du joueur conservées avec le livre. */
type PlayerList =
  'declaredItems' | 'declaredPurchases' | 'declaredEndurance' | 'declaredPlaces' | 'placePins';

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

  /** Termes marqués « Pas un objet » par le joueur, valables pour tous les livres. */
  userNonItems(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(USER_NON_ITEMS_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }

  addUserNonItem(term: string): string[] {
    return this.saveUserNonItems([...new Set([...this.userNonItems(), term])]);
  }

  /** Annule un « Pas un objet » : le terme redevient détectable. */
  removeUserNonItem(term: string): string[] {
    return this.saveUserNonItems(this.userNonItems().filter((t) => t !== term));
  }

  private saveUserNonItems(list: string[]): string[] {
    try {
      localStorage.setItem(USER_NON_ITEMS_KEY, JSON.stringify(list));
    } catch {
      // Stockage indisponible : le choix vaut pour cette visite seulement.
    }
    return list;
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

  /** Mémorise un objet déclaré à la main dans une section ; retourne la liste à jour. */
  async declareItem(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredItems', (list) => [...new Set([...list, key])]);
  }

  async undeclareItem(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredItems', (list) => list.filter((k) => k !== key));
  }

  /** Mémorise un achat déclaré à la main (`<section>|<prix>|<nom>`) ; retourne la liste à jour. */
  async declarePurchase(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredPurchases', (list) => [...new Set([...list, key])]);
  }

  async undeclarePurchase(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredPurchases', (list) => list.filter((k) => k !== key));
  }

  /** Mémorise un lieu déclaré à la main (`<section>|<texte>`) ; retourne la liste à jour. */
  async declarePlace(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredPlaces', (list) => [...new Set([...list, key])]);
  }

  async undeclarePlace(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredPlaces', (list) => list.filter((k) => k !== key));
  }

  /** Place (ou déplace) l'épingle d'un lieu sur la carte (`<nom>|<x>|<y>`, fractions) ; retourne la liste. */
  async setPlacePin(bookId: string, name: string, x: number, y: number): Promise<string[]> {
    const entry = `${name}|${x.toFixed(4)}|${y.toFixed(4)}`;
    return this.updateList(bookId, 'placePins', (list) => [
      ...list.filter((k) => k.split('|')[0].toLowerCase() !== name.toLowerCase()),
      entry,
    ]);
  }

  async removePlacePin(bookId: string, entry: string): Promise<string[]> {
    return this.updateList(bookId, 'placePins', (list) => list.filter((k) => k !== entry));
  }

  /** Mémorise un lien d'ENDURANCE déclaré (`<section>|<montant>|<texte>`) ; retourne la liste à jour. */
  async declareEndurance(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredEndurance', (list) => [...new Set([...list, key])]);
  }

  async undeclareEndurance(bookId: string, key: string): Promise<string[]> {
    return this.updateList(bookId, 'declaredEndurance', (list) => list.filter((k) => k !== key));
  }

  private async updateList(
    bookId: string,
    field: PlayerList,
    update: (list: string[]) => string[],
  ): Promise<string[]> {
    const db = await database();
    const book = await db.get('books', bookId);
    if (!book) return [];
    const list = update(book[field] ?? []);
    await db.put('books', { ...book, [field]: list });
    return list;
  }

  /** Annule un « Pas ici » ; retourne la liste à jour. */
  async restoreItem(bookId: string, key: string): Promise<string[]> {
    const db = await database();
    const book = await db.get('books', bookId);
    if (!book) return [];
    const dismissedItems = (book.dismissedItems ?? []).filter((k) => k !== key);
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
    if (previous) {
      book = {
        ...book,
        meta: {
          ...book.meta,
          dismissedItems: previous.dismissedItems,
          declaredItems: previous.declaredItems,
          declaredPurchases: previous.declaredPurchases,
          declaredEndurance: previous.declaredEndurance,
          declaredPlaces: previous.declaredPlaces,
          placePins: previous.placePins,
        },
      };
    }
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
