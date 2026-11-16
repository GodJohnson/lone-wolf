import { parseBookLink } from './blocks.component';

describe('parseBookLink', () => {
  it('reconnaît sections et pages', () => {
    expect(parseBookLink('sect141.htm')).toEqual({ kind: 'section', number: 141 });
    expect(parseBookLink('random.htm')).toEqual({ kind: 'page', id: 'random' });
    expect(parseBookLink('discplnz.htm#healing')).toEqual({ kind: 'page', id: 'discplnz' });
    expect(parseBookLink('../other/x.png')).toBeNull();
  });
});
