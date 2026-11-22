import { Block } from '../book/book.models';
import { buildLexicon, isConsumable, priceRecordsOf } from './consumables';
import { parsePriceLine } from './purchases';

const ul = (items: string[]): Block => ({
  kind: 'html',
  html: `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`,
});

describe('consommables', () => {
  it('parsePriceLine garde l’indication entre parenthèses', () => {
    expect(
      parsePriceLine('Potion of Laumspur (restores 4 ENDURANCE points)—5 Gold Crowns'),
    ).toMatchObject({
      name: 'Potion of Laumspur',
      price: 5,
      effect: 'restores 4 ENDURANCE points',
    });
    expect(parsePriceLine('Sword—4 Gold Crowns')?.effect).toBeUndefined();
  });

  it('relève les prix des listes et des phrases d’achat', () => {
    const records = priceRecordsOf([
      {
        number: 154,
        blocks: [
          ul([
            'Potion of Laumspur (restores 4 ENDURANCE points)&mdash;5 Gold Crowns',
            'Sword&mdash;4 Gold Crowns',
          ]),
        ],
      },
      {
        number: 123,
        blocks: [
          {
            kind: 'html',
            html: '<p>A handful of Alether Berries costs 3 Gold Crowns. You may purchase up to 3 handfuls.</p>',
          },
        ],
      },
    ]);
    expect(records).toEqual([
      { name: 'Potion of Laumspur', price: 5, section: 154, effect: 'restores 4 ENDURANCE points' },
      { name: 'Sword', price: 4, section: 154 },
      { name: 'Alether Berries', price: 3, section: 123 },
    ]);
  });

  it('ne garde que les consommables, regroupés par nom avec leurs prix par livre', () => {
    const lexicon = buildLexicon([
      {
        number: 5,
        records: [
          {
            name: 'Potion of Laumspur',
            price: 5,
            section: 154,
            effect: 'restores 4 ENDURANCE points',
          },
          { name: 'Sword', price: 4, section: 154 },
        ],
      },
      {
        number: 2,
        records: [
          { name: 'Potion of Laumspur', price: 4, section: 12 },
          { name: 'Potion of Laumspur', price: 4, section: 99 },
        ],
      },
      { number: 6, records: [{ name: 'Alether Berries', price: 3, section: 123 }] },
    ]);
    const names = lexicon.map((c) => c.name);
    expect(names).toContain('Potion of Laumspur');
    expect(names).not.toContain('Sword');
    const laumspur = lexicon.find((c) => c.name === 'Potion of Laumspur')!;
    expect(laumspur.heal).toBe(4);
    expect(laumspur.notes).toEqual(['restores 4 ENDURANCE points']);
    expect(laumspur.prices).toEqual([
      { price: 4, book: 2, sections: [12, 99] },
      { price: 5, book: 5, sections: [154] },
    ]);
    expect(lexicon.find((c) => c.name === 'Alether Berries')).toMatchObject({
      combatSkill: 2,
      prices: [{ price: 3, book: 6, sections: [123] }],
    });
  });

  it('un objet à effet connu ou à nom de potion est un consommable, une arme non', () => {
    expect(isConsumable('Tincture of Calacena')).toBe(true);
    expect(isConsumable('Alether Berries')).toBe(true);
    expect(isConsumable('Dagger')).toBe(false);
    expect(isConsumable('Dagger', 'a note')).toBe(true);
  });
});
