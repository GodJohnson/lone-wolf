import { fakeBookZip } from '../../../testing/fake-book';
import { BookImportError, parseBookEntries } from './book-importer';

describe('parseBookEntries', () => {
  const book = parseBookEntries(fakeBookZip());

  it('déduit les métadonnées du livre', () => {
    expect(book.meta).toMatchObject({
      id: '99test',
      number: 99,
      title: 'The Test Book',
      authors: 'Jane Author',
      lang: 'en',
      sectionCount: 3,
      disciplines: ['Fogsight', 'Healing'],
      copyright: 'Text © 2026 Jane Author.',
    });
  });

  it('importe les sections triées et les pages dans l’ordre du sommaire', () => {
    expect(book.sections.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(book.meta.pages.map((p) => p.id)).toEqual(['gamerulz', 'discplnz']);
  });

  it('importe les images avec leur type MIME', () => {
    expect(book.images).toHaveLength(1);
    expect(book.images[0]).toMatchObject({ bookId: '99test', name: 'ill1.png' });
    expect(book.images[0].blob.type).toBe('image/png');
  });

  it('rejette une archive sans sect1.htm', () => {
    expect(() => parseBookEntries({ 'readme.txt': new Uint8Array() })).toThrow(BookImportError);
  });
});
