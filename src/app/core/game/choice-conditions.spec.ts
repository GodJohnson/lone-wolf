import { Block } from '../book/book.models';
import { conditionClause, evaluateChoices } from './choice-conditions';

const BOOK = ['Camouflage', 'Hunting', 'Sixth Sense', 'Tracking', 'Mind Over Matter'];
const choice = (text: string, target = 1): Block => ({ kind: 'choice', html: text, target });

function statuses(blocks: Block[], owned: string[]) {
  return evaluateChoices(blocks, owned, BOOK).map((c) => c && `${c.status}${c.negated ? '!' : ''}`);
}

describe('choice-conditions', () => {
  it('extrait la clause conditionnelle', () => {
    expect(conditionClause('If you have the Kai Discipline of Tracking, turn to 69.')).toBe(
      'If you have the Kai Discipline of Tracking',
    );
    expect(conditionClause('If you possess Tracking, turn immediately to 4.')).toBe(
      'If you possess Tracking',
    );
    expect(conditionClause('If you lack it, you may run by turning to 5.')).toBe('If you lack it');
  });

  it('discipline simple, possédée ou non', () => {
    const blocks = [
      choice(
        'If you have the Kai Discipline of <span class="smallcaps">Tracking</span>, turn to 69.',
      ),
    ];
    expect(statuses(blocks, ['Tracking'])).toEqual(['met']);
    expect(statuses([...blocks, choice('Otherwise, turn to 2.')], [])).toEqual([
      'unmet',
      'unknown',
    ]);
  });

  it('listes « or » / « either » (une suffit) et « both » / « and » (toutes)', () => {
    expect(
      statuses(
        [
          choice('If you have the Kai Discipline of Hunting, Tracking, or Camouflage, turn to 3.'),
          choice('Else turn to 4.'),
        ],
        ['Camouflage'],
      ),
    ).toEqual(['met', 'unknown']);
    expect(
      statuses(
        [choice('If you possess either the Kai Discipline of Tracking or Sixth Sense, turn to 3.')],
        ['Sixth Sense'],
      ),
    ).toEqual(['met']);
    expect(
      statuses(
        [
          choice('If you possess the Kai Disciplines of both Camouflage and Hunting, turn to 3.'),
          choice('Else turn to 4.'),
        ],
        ['Hunting'],
      ),
    ).toEqual(['unmet', 'unknown']);
  });

  it('« wish to use … to <but> » reste reconnu', () => {
    expect(
      statuses(
        [
          choice(
            'If you wish to use your Kai Discipline of Mind Over Matter to lift the bar, turn to 3.',
          ),
        ],
        ['Mind Over Matter'],
      ),
    ).toEqual(['met']);
  });

  it('négations : « this skill » vise la dernière condition, « either of these » toutes', () => {
    const blocks = [
      choice('If you have the Kai Discipline of Tracking, turn to 3.'),
      choice('If you do not possess this skill, turn to 4.'),
    ];
    expect(statuses(blocks, ['Tracking'])).toEqual(['met', 'unmet!']);
    expect(statuses(blocks, [])).toEqual(['unmet', 'met!']);
    const pair = [
      choice('If you have the Kai Discipline of Hunting or Tracking, turn to 3.'),
      choice('If you do not have either of these skills, turn to 4.'),
    ];
    expect(statuses(pair, ['Hunting'])).toEqual(['met', 'unmet!']);
  });

  it('reste prudent : rang Kaï, objets, « or if you do not wish »', () => {
    expect(
      statuses(
        [
          choice(
            'If you have the Kai Discipline of Tracking and have reached the Kai rank of Guardian, turn to 3.',
          ),
          choice('If you do not possess this skill, turn to 4.'),
        ],
        [],
      ),
    ).toEqual(['unknown', 'unknown']);
    expect(
      statuses(
        [
          choice('If you have the Kai Discipline of Tracking, turn to 3.'),
          choice('If you do not possess this skill, or if you do not wish to use it, turn to 4.'),
        ],
        [],
      ),
    ).toEqual(['unmet', 'unknown']);
    expect(statuses([choice('If you have the Kai Discipline of Flying, turn to 3.')], [])).toEqual([
      'unknown',
    ]);
  });

  it('ne bloque jamais tous les choix d’une section', () => {
    expect(
      statuses([choice('If you have the Kai Discipline of Tracking, turn to 3.')], []),
    ).toEqual(['unknown']);
  });

  it('ignore les blocs qui ne sont pas des choix', () => {
    expect(evaluateChoices([{ kind: 'html', html: '<p>x</p>' }], [], BOOK)).toEqual([null]);
  });
});
