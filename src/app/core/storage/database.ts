import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { BookMeta, ImageRecord, PageRecord, SectionRecord } from '../book/book.models';
import { GameState } from '../game/game.models';

/**
 * Base IndexedDB locale au navigateur. Rien n'est envoyé à un serveur :
 * livres importés et parties restent sur l'appareil du joueur.
 */
interface LoneWolfDb extends DBSchema {
  books: { key: string; value: BookMeta };
  sections: { key: [string, number]; value: SectionRecord; indexes: { byBook: string } };
  pages: { key: [string, string]; value: PageRecord; indexes: { byBook: string } };
  images: { key: [string, string]; value: ImageRecord; indexes: { byBook: string } };
  games: { key: string; value: GameState };
}

const DB_NAME = 'lone-wolf';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LoneWolfDb>> | null = null;

export function database(): Promise<IDBPDatabase<LoneWolfDb>> {
  dbPromise ??= openDB<LoneWolfDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('books', { keyPath: 'id' });
      db.createObjectStore('sections', { keyPath: ['bookId', 'number'] }).createIndex(
        'byBook',
        'bookId',
      );
      db.createObjectStore('pages', { keyPath: ['bookId', 'id'] }).createIndex('byBook', 'bookId');
      db.createObjectStore('images', { keyPath: ['bookId', 'name'] }).createIndex(
        'byBook',
        'bookId',
      );
      db.createObjectStore('games', { keyPath: 'bookId' });
    },
  });
  return dbPromise;
}
