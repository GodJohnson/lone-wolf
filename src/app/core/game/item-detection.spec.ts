import { Block } from '../book/book.models';
import {
  ITEM_LINK_PREFIX,
  annotateItems,
  buildNonItemLexicon,
  guessSlot,
  itemKey,
} from './item-detection';

const p = (html: string): Block => ({ kind: 'html', html: `<p>${html}</p>` });

describe('item-detection', () => {
  it('rend cliquable un objet trouvé et devine une arme', () => {
    const { blocks, items } = annotateItems([
      p('In the cellar you discover a Rusty Spear. You may keep this Weapon if you wish.'),
    ]);
    expect(items).toEqual([{ kind: 'item', name: 'Rusty Spear', slot: 'weapons' }]);
    expect((blocks[0] as { html: string }).html).toContain(
      `a <a href="${ITEM_LINK_PREFIX}0" class="item-link">Rusty Spear</a>`,
    );
  });

  it('détecte l’or, les Repas et l’emplacement indiqué par le texte', () => {
    const { items } = annotateItems([
      p(
        'The box holds 7 Gold Crowns, two Meals and a Moon Amulet (mark it as a Special Item). You may take them.',
      ),
    ]);
    expect(items).toEqual([
      { kind: 'gold', amount: 7, label: '7 Gold Crowns' },
      { kind: 'meals', count: 2, label: 'two Meals' },
      { kind: 'item', name: 'Moon Amulet', slot: 'specialItems' },
    ]);
  });

  it('ignore les paragraphes sans prise possible et les phrases de perte', () => {
    expect(annotateItems([p('A Grey Beast blocks the road to the Old Bridge.')]).items).toEqual([]);
    expect(
      annotateItems([
        p('Erase the Moon Amulet from your Action Chart. You may keep the rest if you wish.'),
      ]).items,
    ).toEqual([]);
  });

  it('exclut possessifs, « Kai … » et les mots du lexique (sauf arme qualifiée)', () => {
    const lexicon = ['grey', 'beast', 'giak'];
    const { items } = annotateItems(
      [
        p(
          'You find the Beast’s purse, a Grey Beast, the Kai Discipline of Tracking and a Giak Spear. Take them if you wish.',
        ),
      ],
      lexicon,
    );
    expect(items).toEqual([{ kind: 'item', name: 'Giak Spear', slot: 'weapons' }]);
  });

  it('construit le lexique : ennemis, disciplines, mots employés sans article', () => {
    const sections = [
      {
        blocks: [
          {
            kind: 'combat',
            html: '',
            enemy: { name: 'Grey Beast', combatSkill: 1, endurance: 1 },
          } as Block,
        ],
      },
      {
        blocks: [
          p('You ride to Westmoor at dawn.'),
          p('The road from Westmoor is long.'),
          p('You find a Rope.'),
        ],
      },
    ];
    const lexicon = buildNonItemLexicon(sections, ['Mind Over Matter']);
    expect(lexicon).toEqual(
      expect.arrayContaining(['grey', 'beast', 'westmoor', 'mind', 'matter']),
    );
    expect(lexicon).not.toContain('rope');
  });

  it('devine l’emplacement', () => {
    expect(guessSlot('Silver Key', 'mark the Silver Key as a Special Item.')).toBe('specialItems');
    expect(guessSlot('Jewelled Mace', 'mark the Jewelled Mace as a Special Item.')).toBe(
      'specialItems',
    );
    expect(guessSlot('Bone Sword', 'You discover a Bone Sword.')).toBe('weapons');
    expect(guessSlot('Rope', 'You may take the Rope.')).toBe('backpack');
  });

  it('« N Crowns » sans « Gold » est de l’or', () => {
    expect(annotateItems([p('His purse holds 12 Crowns. You may take them.')]).items).toEqual([
      { kind: 'gold', amount: 12, label: '12 Crowns' },
    ]);
  });

  it('les termes classés : objet connu sans article, non-objet jamais lié', () => {
    const { items } = annotateItems([
      p(
        'You may keep the Torches and some Alether, but the Durncrag is too far. Take them if you wish.',
      ),
    ]);
    expect(items.map((i) => (i.kind === 'item' ? i.name : i.label))).toEqual([
      'Torches',
      'Alether',
    ]);
  });

  it('un objet écarté (« Pas ramassable ici ») n’est plus lié, ni ses formes plus courtes', () => {
    const blocks = [
      p('You discover a Moon Amulet and a Rusty Spear. You may keep them if you wish.'),
    ];
    const { items } = annotateItems(blocks, [], new Set(['Moon Amulet']));
    expect(items).toEqual([{ kind: 'item', name: 'Rusty Spear', slot: 'weapons' }]);
    expect(itemKey({ kind: 'gold', amount: 3, label: '3 Gold Crowns' })).toBe('3 Gold Crowns');
  });

  it('« Pas un objet » : le terme n’est plus jamais lié, même s’il est connu', () => {
    const blocks = [p('You find a Grey Lantern and some Torches. You may take them if you wish.')];
    expect(annotateItems(blocks, [], new Set(), ['grey lantern', 'Torches']).items).toEqual([]);
  });
});
