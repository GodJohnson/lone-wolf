import { deflateSync, strToU8 } from 'fflate';
import { GameState } from './game.models';
import { TransferError, decodeGame, encodeGame, extractPayload } from './transfer';
import { newCharacter } from './rules';

function game(overrides: Partial<GameState> = {}): GameState {
  const character = {
    ...newCharacter('kai', 4, 6),
    disciplines: ['Camouflage', 'Healing', 'Hunting', 'Mindblast', 'Sixth Sense'],
    weapons: ['Axe', 'Sword'],
    backpack: ['Rope', 'Healing Potion'],
    specialItems: ['Map of Sommerlund', 'Chainmail Waistcoat'],
    gold: 12,
    meals: 2,
    notes: 'Clé cachée sous la pierre — é à ñ',
  };
  return {
    bookId: '01fftd',
    section: 197,
    history: [1, 85, 275, 19],
    character,
    combat: null,
    foughtIn: [17, 85],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const forge = (data: unknown) => {
  const bytes = deflateSync(strToU8(JSON.stringify(data)));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('transfer', () => {
  it('aller-retour : la partie retrouvée est identique (accents compris)', () => {
    const original = game();
    const restored = decodeGame(encodeGame(original).payload);
    expect(restored).toMatchObject({
      bookId: '01fftd',
      section: 197,
      history: [1, 85, 275, 19],
      foughtIn: [17, 85],
      combat: null,
    });
    expect(restored.character).toEqual(original.character);
  });

  it('reste compact : un QR code lisible à l’écran', () => {
    expect(encodeGame(game()).payload.length).toBeLessThan(700);
  });

  it('limite l’historique et raccourcit des notes trop longues', () => {
    const long = game({
      history: Array.from({ length: 100 }, (_, i) => i + 1),
      character: { ...game().character, notes: 'x'.repeat(2000) },
    });
    const result = encodeGame(long);
    const restored = decodeGame(result.payload);
    expect(result.notesTruncated).toBe(true);
    expect(restored.history).toHaveLength(20);
    expect(restored.character.notes).toHaveLength(400);
  });

  it('accepte un lien complet ou les seules données', () => {
    const { payload } = encodeGame(game());
    expect(decodeGame(`https://exemple.test/lone-wolf/#/transfer/${payload}`).section).toBe(197);
    expect(extractPayload(`  ${payload}  `)).toBe(payload);
  });

  it('rejette le contenu corrompu, tronqué ou de mauvaise forme', () => {
    const { payload } = encodeGame(game());
    for (const bad of ['', 'abc', payload.slice(0, 40), payload + '!!', '<script>']) {
      expect(() => decodeGame(bad)).toThrow(TransferError);
    }
  });

  it('rejette les valeurs hors limites ou de mauvais type', () => {
    const base = { v: 1, b: '01fftd', s: 5, h: [], f: [], m: 0, c: game().character };
    expect(() => decodeGame(forge({ ...base, s: 0 }))).toThrow(TransferError);
    expect(() => decodeGame(forge({ ...base, s: 1.5 }))).toThrow(TransferError);
    expect(() => decodeGame(forge({ ...base, b: '../x' }))).toThrow(TransferError);
    expect(() => decodeGame(forge({ ...base, c: { ...base.c, gold: 99999 } }))).toThrow(
      TransferError,
    );
    expect(() =>
      decodeGame(
        forge({ ...base, c: { ...base.c, weapons: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] } }),
      ),
    ).toThrow(TransferError);
    expect(() => decodeGame(forge({ ...base, c: { ...base.c, notes: 42 } }))).not.toThrow();
  });

  it('distingue une version inconnue', () => {
    const base = { v: 2, b: '01fftd', s: 5, h: [], f: [], m: 0, c: game().character };
    expect(() => decodeGame(forge(base))).toThrowError(
      expect.objectContaining({ code: 'version' }),
    );
  });
});
