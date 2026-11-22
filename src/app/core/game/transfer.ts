import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { Character, GameState, Stash } from './game.models';

/**
 * Transfert d'une partie d'un appareil à l'autre : la partie est compressée et encodée dans un lien
 * (donc dans un QR code). Aucun serveur, et jamais le texte du livre : seulement l'état de jeu.
 * Le contenu reçu est considéré comme non fiable : tout est validé et borné avant d'être utilisé.
 */
export type TransferErrorCode = 'invalid' | 'version' | 'tooBig';

export class TransferError extends Error {
  constructor(public readonly code: TransferErrorCode) {
    super(code);
  }
}

const VERSION = 1;
const MAX_PAYLOAD_CHARS = 6000;
const MAX_HISTORY = 20;
const MAX_NOTES = 400;

export interface TransferResult {
  payload: string;
  /** Les notes ont été raccourcies pour tenir dans le QR code. */
  notesTruncated: boolean;
}

export function encodeGame(state: GameState): TransferResult {
  const notesTruncated = state.character.notes.length > MAX_NOTES;
  const data = {
    v: VERSION,
    b: state.bookId,
    s: state.section,
    h: state.history.slice(-MAX_HISTORY),
    c: { ...state.character, notes: state.character.notes.slice(0, MAX_NOTES) },
    f: [...new Set(state.foughtIn)].slice(-50),
    m: state.mealResolved ? 1 : 0,
    x: (state.flags ?? []).slice(0, 20),
  };
  const payload = toBase64Url(deflateSync(strToU8(JSON.stringify(data)), { level: 9 }));
  if (payload.length > MAX_PAYLOAD_CHARS) throw new TransferError('tooBig');
  return { payload, notesTruncated };
}

/** Accepte un lien complet (`…#/transfer/<données>`) ou les seules données. */
export function extractPayload(text: string): string {
  const trimmed = text.trim();
  const marker = '#/transfer/';
  const index = trimmed.indexOf(marker);
  const raw = index >= 0 ? trimmed.slice(index + marker.length) : trimmed;
  return raw.split(/[?\s]/)[0];
}

export function decodeGame(input: string): GameState {
  const payload = extractPayload(input);
  if (!payload || payload.length > MAX_PAYLOAD_CHARS || !/^[A-Za-z0-9_-]+$/.test(payload)) {
    throw new TransferError('invalid');
  }
  let data: unknown;
  try {
    const json = strFromU8(inflateSync(fromBase64Url(payload)));
    if (json.length > 50_000) throw new Error('too large');
    data = JSON.parse(json);
  } catch {
    throw new TransferError('invalid');
  }
  return validate(data);
}

function validate(data: unknown): GameState {
  const d = asRecord(data);
  if (d['v'] !== VERSION)
    throw new TransferError(typeof d['v'] === 'number' ? 'version' : 'invalid');
  const bookId = str(d['b'], 40);
  if (!/^[a-z0-9_-]+$/i.test(bookId)) throw new TransferError('invalid');
  const now = new Date().toISOString();
  return {
    bookId,
    section: int(d['s'], 1, 9999),
    history: list(d['h'], MAX_HISTORY).map((n) => int(n, 1, 9999)),
    character: character(d['c']),
    combat: null,
    foughtIn: list(d['f'], 50).map((n) => int(n, 1, 9999)),
    mealResolved: d['m'] === 1,
    flags: d['x'] === undefined ? [] : list(d['x'], 20).map((f) => str(f, 40)),
    createdAt: now,
    updatedAt: now,
  };
}

function character(value: unknown): Character {
  const c = asRecord(value);
  const names = (v: unknown, max: number) => list(v, max).map((s) => str(s, 80));
  const enduranceMax = int(c['enduranceMax'], 1, 300);
  const weaponskill = c['weaponskill'];
  return {
    combatSkill: int(c['combatSkill'], 0, 300),
    endurance: Math.min(int(c['endurance'], 0, 300), enduranceMax),
    enduranceMax,
    disciplines: names(c['disciplines'], 12),
    weaponskill: weaponskill === null ? null : str(weaponskill, 40),
    weapons: names(c['weapons'], 6),
    backpack: names(c['backpack'], 20),
    specialItems: names(c['specialItems'], 40),
    gold: int(c['gold'], 0, 500),
    meals: int(c['meals'], 0, 50),
    notes: typeof c['notes'] === 'string' ? c['notes'].slice(0, MAX_NOTES) : '',
    ...(c['stash'] === undefined ? {} : { stash: stash(c['stash']) }),
    ...(c['arrows'] === undefined ? {} : { arrows: int(c['arrows'], 0, 99) }),
    ...(c['weaponmastery'] === undefined ? {} : { weaponmastery: names(c['weaponmastery'], 10) }),
    ...(c['loreApplied'] === undefined ? {} : { loreApplied: loreApplied(c['loreApplied']) }),
  };
}

function loreApplied(value: unknown): { cs: number; ep: number } {
  const l = asRecord(value);
  return { cs: int(l['cs'], 0, 20), ep: int(l['ep'], 0, 40) };
}

function stash(value: unknown): Stash {
  const s = asRecord(value);
  const names = (v: unknown, max: number) => list(v, max).map((n) => str(n, 80));
  return {
    weapons: names(s['weapons'], 6),
    backpack: names(s['backpack'], 20),
    specialItems: names(s['specialItems'], 40),
    gold: int(s['gold'], 0, 500),
    meals: int(s['meals'], 0, 50),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TransferError('invalid');
  return value as Record<string, unknown>;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new TransferError('invalid');
  return value;
}
function int(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new TransferError('invalid');
  }
  return value;
}
function str(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new TransferError('invalid');
  return value;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
