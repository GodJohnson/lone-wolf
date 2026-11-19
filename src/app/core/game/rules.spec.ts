import { Character } from './game.models';
import {
  effectiveCombatSkill,
  healingOnLeave,
  isSkilledWeapon,
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

  it('compte un objet spécial qui est une arme (Magic Spear) comme une arme portée', () => {
    const c = hero({
      disciplines: ['Weaponskill'],
      weaponskill: 'Spear',
      weapons: [],
      specialItems: ['Magic Spear'],
    });
    expect(effectiveCombatSkill(c, { modifier: 0, useMindblast: false })).toMatchObject({
      noWeapon: 0,
      weaponskill: 2,
    });
    const other = hero({ weapons: [], specialItems: ['Silver Helm'] });
    expect(effectiveCombatSkill(other, { modifier: 0, useMindblast: false }).noWeapon).toBe(-4);
  });

  it('Sommerswerd : +8 HAB, +2 Weaponskill avec une épée (soit +10), compte comme arme', () => {
    const base = { weapons: [], specialItems: ['Sommerswerd'] };
    const none = hero({ ...base });
    expect(effectiveCombatSkill(none, { modifier: 0, useMindblast: false })).toMatchObject({
      noWeapon: 0,
      items: 8,
      weaponskill: 0,
    });
    const skilled = hero({ ...base, disciplines: ['Weaponskill'], weaponskill: 'Broadsword' });
    const b = effectiveCombatSkill(skilled, { modifier: 0, useMindblast: false });
    expect(b.items + b.weaponskill).toBe(10);
    const axe = hero({ ...base, disciplines: ['Weaponskill'], weaponskill: 'Axe' });
    expect(effectiveCombatSkill(axe, { modifier: 0, useMindblast: false }).weaponskill).toBe(0);
  });

  it('Sommerswerd : double les pertes d’un mort-vivant, sans cumuler le +2 avec une autre arme', () => {
    const c = hero({
      disciplines: ['Weaponskill'],
      weaponskill: 'Sword',
      weapons: ['Sword'],
      specialItems: ['Sommerswerd'],
    });
    expect(effectiveCombatSkill(c, { modifier: 0, useMindblast: false }).weaponskill).toBe(2);
    const enemy = { name: 'Helghast', combatSkill: 22, endurance: 30 };
    const start = startCombat(1, 0, enemy, c);
    expect(start.undead).toBe(true);
    const normal = playRound({ ...start, undead: false }, c, 9).combat.rounds[0].enemyLoss;
    const doubled = playRound(start, c, 9).combat.rounds[0].enemyLoss;
    expect(doubled).toBe((normal as number) * 2);
    const plain = hero({ weapons: ['Sword'] });
    expect(playRound(startCombat(1, 0, enemy, plain), plain, 9).combat.rounds[0].enemyLoss).toBe(
      playRound({ ...startCombat(1, 0, enemy, plain), undead: false }, plain, 9).combat.rounds[0]
        .enemyLoss,
    );
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

describe('isSkilledWeapon', () => {
  const c = (skill: string) =>
    ({
      ...newCharacter('kai', 0, 0),
      disciplines: ['Weaponskill'],
      weaponskill: skill,
    }) as Character;
  it('reconnaît l’arme maîtrisée et ses variantes nommées, pas un autre type de la table', () => {
    expect(isSkilledWeapon(c('Spear'), 'Spear')).toBe(true);
    expect(isSkilledWeapon(c('Spear'), 'Giak Spear')).toBe(true);
    expect(isSkilledWeapon(c('Sword'), 'Short Sword')).toBe(false);
    expect(isSkilledWeapon(c('Sword'), 'Broadsword')).toBe(false);
    expect(isSkilledWeapon({ ...c('Spear'), disciplines: [] }, 'Spear')).toBe(false);
  });
  it('donne +2 en combat avec une variante (« Giak Spear »)', () => {
    const hero = { ...c('Spear'), weapons: ['Giak Spear'] };
    expect(effectiveCombatSkill(hero, { modifier: 0, useMindblast: false }).weaponskill).toBe(2);
  });
});
