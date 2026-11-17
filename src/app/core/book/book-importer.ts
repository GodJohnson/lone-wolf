import { unzip, Unzipped } from 'fflate';
import { BookLanguage, ImageRecord, PageRecord, ParsedBook, SectionRecord } from './book.models';
import { seriesOf } from './catalog';
import {
  mainText,
  pageTitle,
  parseBlocks,
  parseDisciplines,
  parseDocument,
  parseTableOfContents,
  sectionNumberFromFile,
} from './section-parser';
import { normalizedText } from './html-cleaner';
import { buildNonItemLexicon } from '../game/item-detection';

/** Garde-fous contre un zip malveillant ou erroné (zip bomb, fichier sans rapport). */
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/** Pages techniques sans intérêt dans l'application. */
const IGNORED_PAGES = new Set(['toc', 'numbered']);

export class BookImportError extends Error {
  constructor(public readonly code: 'tooLarge' | 'notAZip' | 'notABook') {
    super(code);
  }
}

export async function importBookZip(file: Blob): Promise<ParsedBook> {
  if (file.size > MAX_ZIP_BYTES) throw new BookImportError('tooLarge');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await unzipAsync(bytes);
  return parseBookEntries(entries);
}

function unzipAsync(bytes: Uint8Array): Promise<Unzipped> {
  let total = 0;
  return new Promise((resolve, reject) => {
    unzip(
      bytes,
      {
        filter: (file) => {
          if (file.originalSize > MAX_ENTRY_BYTES) return false;
          total += file.originalSize;
          return /\.(htm|html|png|gif|jpe?g)$/i.test(file.name);
        },
      },
      (err, data) => {
        if (err) reject(new BookImportError('notAZip'));
        else if (total > MAX_UNCOMPRESSED_BYTES) reject(new BookImportError('tooLarge'));
        else resolve(data);
      },
    );
  });
}

export function parseBookEntries(entries: Unzipped): ParsedBook {
  // Le zip officiel contient `en/xhtml/lw/<code>/sect1.htm` : on repère le dossier du livre.
  const sect1Path = Object.keys(entries).find((p) => /(^|\/)sect1\.htm$/i.test(p));
  if (!sect1Path) throw new BookImportError('notABook');
  const baseDir = sect1Path.slice(0, sect1Path.length - 'sect1.htm'.length);
  const id = (baseDir.split('/').filter(Boolean).pop() ?? 'book').toLowerCase();

  const decoder = new TextDecoder('utf-8');
  const files = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(entries)) {
    if (!path.startsWith(baseDir)) continue;
    const name = path.slice(baseDir.length);
    if (name.includes('/')) continue;
    files.set(name, data);
  }

  const readDoc = (name: string): Document | null => {
    const data = files.get(name);
    return data ? parseDocument(decoder.decode(data)) : null;
  };

  const sections: SectionRecord[] = [];
  const pagesByName = new Map<string, PageRecord>();
  const images: ImageRecord[] = [];

  for (const [name, data] of files) {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_TYPES[ext]) {
      images.push({
        bookId: id,
        name,
        blob: new Blob([data as BlobPart], { type: IMAGE_TYPES[ext] }),
      });
      continue;
    }
    if (ext !== 'htm' && ext !== 'html') continue;

    const doc = parseDocument(decoder.decode(data));
    const root = mainText(doc);
    if (!root) continue;

    const number = sectionNumberFromFile(name);
    if (number !== null) {
      sections.push({ bookId: id, number, blocks: parseBlocks(root, true) });
      continue;
    }
    const pageId = name.replace(/\.html?$/i, '');
    if (IGNORED_PAGES.has(pageId) || /^ill\d+$/i.test(pageId)) continue;
    pagesByName.set(pageId, {
      bookId: id,
      id: pageId,
      title: pageTitle(doc) || pageId,
      blocks: parseBlocks(root, true),
    });
  }

  if (!sections.length) throw new BookImportError('notABook');
  sections.sort((a, b) => a.number - b.number);

  const sect1 = readDoc('sect1.htm')!;
  const toc = readDoc('toc.htm');
  const discplnz = readDoc('discplnz.htm');

  // Ordre des pages : celui de la table des matières, puis les pages restantes.
  const pageRefs = (toc ? parseTableOfContents(toc) : [])
    .filter((ref) => pagesByName.has(ref.id))
    .map((ref) => ({ id: ref.id, title: ref.title || pagesByName.get(ref.id)!.title }));
  for (const page of pagesByName.values()) {
    if (!pageRefs.some((ref) => ref.id === page.id))
      pageRefs.push({ id: page.id, title: page.title });
  }

  const number = Number(/^(\d+)/.exec(id)?.[1] ?? 0);
  const lang: BookLanguage = (sect1.documentElement.getAttribute('lang') ?? 'en')
    .toLowerCase()
    .startsWith('es')
    ? 'es'
    : 'en';
  const header = sect1.querySelector('#main-header');

  return {
    meta: {
      id,
      number,
      title: normalizedText(header?.querySelector('h1') ?? sect1.createElement('span')) || id,
      authors: normalizedText(header?.querySelector('h2') ?? sect1.createElement('span')),
      lang,
      series: seriesOf(number),
      sectionCount: sections.length,
      disciplines: discplnz ? parseDisciplines(discplnz) : [],
      nonItemWords: buildNonItemLexicon(sections, discplnz ? parseDisciplines(discplnz) : []),
      pages: pageRefs,
      copyright: normalizedText(sect1.querySelector('#license p') ?? sect1.createElement('span')),
      importedAt: new Date().toISOString(),
    },
    sections,
    pages: [...pagesByName.values()],
    images,
  };
}
