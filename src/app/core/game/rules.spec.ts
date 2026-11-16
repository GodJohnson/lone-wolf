import { Character } from './game.models';
import {
  effectiveCombatSkill,
  healingOnLeave,
  newCharacter,
  playRound,
  startCombat,
} from './rules';

function hero(overrides: Partial<Character> = {}): Character {
  return { ...newCharacter('kai', 5, 5), weapons: ['Axe'], ...overrides };
}

describe('rules', () => {
  it('crée un personnage Kaï : 10 + tirage / 20 + tirage', () => {
    const c = newCharacter('kai', 3, 7);
    expect([c.combatSkill, c.endurance, c.enduranceMax]).toEqual([13, 27, 27]);
  });

  it('applique Weaponskill, Mindblast, l’absence d’arme et le modificateur', () => {
    const c = hero({ disciplines: ['Weaponskill', 'Mindblast'], weaponskill: 'Axe' });
    expect(effectiveCombatSkill(c, { modifier: -1, useMindblast: true }).total).toBe(
      15 + 2 + 2 - 1,
    );
    expect(
      effectiveCombatSkill({ ...c, weapons: [] }, { modifier: 0, useMindblast: false }).total,
    ).toBe(15 - 4);
  });

  it('joue un assaut et détecte la victoire', () => {
    const c = hero();
    const combat = startCombat(1, 0, { name: 'Rat', combatSkill: 15, endurance: 3 }, c);
    const { combat: after, character } = playRound(combat, c, 1); // ratio 0, tirage 1 → 3 / 5
    expect(after.enemyEndurance).toBe(0);
    expect(after.outcome).toBe('won');
    expect(character.endurance).toBe(25 - 5);
  });

  it('en cas de fuite, seul Loup Solitaire subit des pertes', () => {
    const c = hero();
    const combat = startCombat(1, 0, { name: 'Rat', combatSkill: 15, endurance: 10 }, c);
    const { combat: after, character } = playRound(combat, c, 1, true);
    expect(after.enemyEndurance).toBe(10);
    expect(after.outcome).toBe('evaded');
    expect(character.endurance).toBe(20);
  });

  it('K tue net', () => {
    const c = hero();
    const combat = startCombat(1, 0, { name: 'Dragon', combatSkill: 40, endurance: 50 }, c);
    expect(playRound(combat, c, 1).combat.outcome).toBe('lost');
  });

  it('Guérison : +1 si la section quittée était sans combat, plafonné', () => {
    const c = hero({ disciplines: ['Healing'], endurance: 20 });
    expect(healingOnLeave(c, 4, []).endurance).toBe(21);
    expect(healingOnLeave(c, 4, [4]).endurance).toBe(20);
    expect(healingOnLeave({ ...c, endurance: 25 }, 4, []).endurance).toBe(25);
    expect(healingOnLeave({ ...c, disciplines: [] }, 4, []).endurance).toBe(20);
  });
});
