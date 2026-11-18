import { FAKE_SECTION_1 } from '../../../testing/fake-book';
import { mainText, parseBlocks, parseDocument, parseEnemy } from './section-parser';

describe('section-parser', () => {
  const blocks = parseBlocks(mainText(parseDocument(FAKE_SECTION_1))!);

  it('ignore le titre (numéro de section) et découpe les blocs', () => {
    expect(blocks.map((b) => b.kind)).toEqual([
      'html',
      'figure',
      'html',
      'combat',
      'html',
      'choice',
      'choice',
    ]);
  });

  it('extrait les cibles des choix', () => {
    const targets = blocks.flatMap((b) => (b.kind === 'choice' ? [b.target] : []));
    expect(targets).toEqual([2, 3]);
  });

  it('extrait les caractéristiques de l’ennemi', () => {
    const combat = blocks.find((b) => b.kind === 'combat');
    expect(combat?.kind === 'combat' && combat.enemy).toEqual({
      name: 'Fog Beast',
      combatSkill: 14,
      endurance: 20,
    });
  });

  it('conserve les entités, la classe smallcaps et les liens internes', () => {
    expect(blocks[0]).toEqual({
      kind: 'html',
      html: '<p>The fog lies <span class="smallcaps">thick</span> on the école road.</p>',
    });
    expect(blocks[4].kind === 'html' && blocks[4].html).toContain('<a href="random.htm">');
  });

  it('référence l’illustration par son nom de fichier', () => {
    expect(blocks[1]).toEqual({ kind: 'figure', image: 'ill1.png' });
  });

  it('parseEnemy tolère les variantes de mise en forme', () => {
    expect(parseEnemy('Kraan: COMBAT SKILL 16 ENDURANCE 24')).toEqual({
      name: 'Kraan',
      combatSkill: 16,
      endurance: 24,
    });
    expect(parseEnemy('Giak 1 COMBAT SKILL: 13 ENDURANCE: 10')).toEqual({
      name: 'Giak 1',
      combatSkill: 13,
      endurance: 10,
    });
    expect(parseEnemy('No stats here')).toBeNull();
  });

  it('garde le texte des panneaux (div.signpost), jusque-là perdu', () => {
    expect(blocks[2]).toEqual({
      kind: 'html',
      html: '<div class="signpost">Fog Inn—Harbour Street</div>',
    });
  });
});
