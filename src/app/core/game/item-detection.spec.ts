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
    expect(items.map((i) => itemKey(i))).toEqual(['Torches', 'Alether']);
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

  it('objet déclaré à la main : toujours lié, même hors paragraphe de trouvaille', () => {
    const blocks = [
      p('The old fisherman keeps a Silver Compass tucked in his belt. The sea is calm.'),
    ];
    expect(annotateItems(blocks).items).toEqual([]);
    const { blocks: out, items } = annotateItems(blocks, [], new Set(), [], ['Silver Compass']);
    expect(items).toEqual([
      { kind: 'item', name: 'Silver Compass', slot: 'backpack', declared: true },
    ]);
    expect((out[0] as { html: string }).html).toContain('class="item-link">Silver Compass</a>');
  });

  it('un objet déclaré n’est pas dupliqué quand la détection le trouve aussi', () => {
    const blocks = [p('You find a Moon Amulet here. You may keep it if you wish.')];
    const { items } = annotateItems(blocks, [], new Set(), [], ['Moon Amulet']);
    expect(items).toHaveLength(1);
  });

  describe('achats', () => {
    const list: Block = {
      kind: 'html',
      html: '<ul><li>Sword&mdash;4 Gold Crowns</li><li>Backpack&mdash;1 Gold Crown</li></ul>',
    };

    it('lie chaque ligne de prix d’une boutique', () => {
      const { blocks, items } = annotateItems([list]);
      expect(items).toEqual([
        { kind: 'purchase', name: 'Sword', price: 4, slot: 'weapons' },
        { kind: 'purchase', name: 'Backpack', price: 1, slot: 'backpack' },
      ]);
      expect((blocks[0] as { html: string }).html).toContain(
        `<li><a href="${ITEM_LINK_PREFIX}0" class="item-link">Sword</a>`,
      );
    });

    it('détecte une phrase « si vous voulez acheter … payez N »', () => {
      const { items } = annotateItems([
        p('If you wish to buy the Bottle of Kourshah, pay the man 5 Gold Crowns and read on.'),
      ]);
      expect(items).toEqual([
        { kind: 'purchase', name: 'Bottle of Kourshah', price: 5, slot: 'backpack' },
      ]);
    });

    it('respecte « Pas ici » et lie les achats déclarés à la main', () => {
      expect(annotateItems([list], [], new Set(['buy:Sword'])).items).toHaveLength(1);
      const text = p('A peddler sells lanterns for a fair price.');
      const { items } = annotateItems(
        [text],
        [],
        new Set(),
        [],
        [],
        [{ name: 'lanterns', price: 3 }],
      );
      expect(items).toEqual([
        { kind: 'purchase', name: 'lanterns', price: 3, slot: 'backpack', declared: true },
      ]);
    });

    it('la clé « Pas ici » d’un achat ne heurte pas celle d’un objet', () => {
      expect(itemKey({ kind: 'purchase', name: 'Sword', price: 4, slot: 'weapons' })).toBe(
        'buy:Sword',
      );
    });
  });

  it('lit le nom entre guillemets à inscrire sur la Feuille (Magic Spear)', () => {
    const { items } = annotateItems([
      p(
        'If you win the combat, you can keep the Spear. Mark it on your <a href="action.htm">Action Chart</a> under the Special Items section as a &lsquo;Magic Spear.&rsquo;',
      ),
    ]);
    expect(items).toEqual([{ kind: 'item', name: 'Magic Spear', slot: 'specialItems' }]);
  });

  describe('ENDURANCE', () => {
    it('lie une perte d’ENDURANCE, même avec le mot dans un élément', () => {
      const { blocks, items } = annotateItems([
        p('You collapse. You lose 2 <span class="smallcaps">ENDURANCE</span> points.'),
      ]);
      expect(items).toEqual([{ kind: 'endurance', amount: -2, label: 'lose 2 ENDURANCE points' }]);
      expect((blocks[0] as { html: string }).html).toContain('class="item-link">lose 2 </a>');
    });

    it('lie un gain, mais pas une perte répétée à chaque assaut', () => {
      expect(annotateItems([p('You regain 3 ENDURANCE points.')]).items).toEqual([
        { kind: 'endurance', amount: 3, label: 'regain 3 ENDURANCE points' },
      ]);
      expect(
        annotateItems([p('You will lose 2 ENDURANCE points for every round of combat.')]).items,
      ).toEqual([]);
    });
  });

  it('lie une perte d’ENDURANCE déclarée à la main et respecte « Pas ici »', () => {
    const text = p('The poison burns your veins and you feel weaker.');
    const { items } = annotateItems(
      [text],
      [],
      new Set(),
      [],
      [],
      [],
      [{ text: 'you feel weaker', amount: -3 }],
    );
    expect(items).toEqual([
      { kind: 'endurance', amount: -3, label: 'you feel weaker', declared: true },
    ]);
    const lose = p('You lose 2 ENDURANCE points.');
    expect(annotateItems([lose], [], new Set(['lose 2 ENDURANCE points'])).items).toEqual([]);
  });

  it('propose le Sommerswerd (Objet spécial) quand le texte dit que vous le possédez', () => {
    const { items } = annotateItems([
      p(
        'Make the necessary adjustments to your COMBAT SKILL total now that you possess the Sommerswerd.',
      ),
    ]);
    expect(items).toEqual([{ kind: 'item', name: 'Sommerswerd', slot: 'specialItems' }]);
  });

  describe('lieux', () => {
    it('lie les noms de lieux de la carte, dans une section', () => {
      const { blocks, items } = annotateItems(
        [p('You ride from Holmgard towards Ragadorn along the coast.')],
        [],
        new Set(),
        [],
        [],
        [],
        [],
        { known: ['Holmgard', 'Ragadorn'], declared: [] },
      );
      expect(items).toEqual([
        { kind: 'place', name: 'Holmgard' },
        { kind: 'place', name: 'Ragadorn' },
      ]);
      expect((blocks[0] as { html: string }).html).toContain(
        'class="item-link place-link">Holmgard</a>',
      );
    });

    it('lie un lieu déclaré à la main, respecte « Pas ici » et la casse des noms connus', () => {
      const text = p('The old fort of Marrow Hill stands by holmgard.');
      const { items } = annotateItems([text], [], new Set(['place:Holmgard']), [], [], [], [], {
        known: ['Holmgard'],
        declared: ['Marrow Hill'],
      });
      expect(items).toEqual([{ kind: 'place', name: 'Marrow Hill', declared: true }]);
    });
  });
});
