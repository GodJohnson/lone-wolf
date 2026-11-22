import { Block } from '../book/book.models';
import { itemEffect, itemSize } from './equipment';
import { parseBuySentence, parseCostSentence, parsePriceLine } from './purchases';

/**
 * Lexique des consommables : prix et effets relevés dans les textes des livres que le joueur a importés
 * (listes de prix, phrases d'achat), complétés par les effets que l'application connaît. Calculé sur
 * l'appareil à partir des livres du joueur : aucun texte de livre n'est embarqué.
 */
export interface PriceRecord {
  name: string;
  price: number;
  section: number;
  /** Indication entre parenthèses de la liste de prix (« restores 4 ENDURANCE points »). */
  effect?: string;
}

const text = (html: string) =>
  new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.textContent ?? '';

/** Prix d'objets d'un livre : lignes de prix (`<li>`), phrases d'achat et « X costs N Gold Crowns ». */
export function priceRecordsOf(
  sections: readonly { number: number; blocks: readonly Block[] }[],
): PriceRecord[] {
  const out: PriceRecord[] = [];
  for (const section of sections) {
    for (const block of section.blocks) {
      if (block.kind !== 'html' || !/Gold\s*(?:&nbsp;|\s)*Crown/i.test(block.html)) continue;
      if (block.html.startsWith('<ul')) {
        const doc = new DOMParser().parseFromString(`<body>${block.html}</body>`, 'text/html');
        for (const li of Array.from(doc.querySelectorAll('li'))) {
          const line = parsePriceLine(li.textContent ?? '');
          if (line) {
            out.push({
              name: line.name,
              price: line.price,
              section: section.number,
              ...(line.effect ? { effect: line.effect } : {}),
            });
          }
        }
      } else if (block.html.startsWith('<p')) {
        const plain = text(block.html).replace(/[\s ]+/g, ' ');
        const buys = /\b(?:purchase|buy)\b/i.test(plain);
        for (const sentence of plain.match(/[^.!?]+[.!?]*/g) ?? []) {
          const found = parseBuySentence(sentence) ?? (buys ? parseCostSentence(sentence) : null);
          if (found) out.push({ name: found.name, price: found.price, section: section.number });
        }
      }
    }
  }
  return out;
}

export interface Consumable {
  name: string;
  /** Indications du livre, telles qu'écrites (anglais). */
  notes: string[];
  /** ENDURANCE rendue en buvant (potion). */
  heal?: number;
  /** Bonus d'HABILETÉ pour un combat (baies…). */
  combatSkill?: number;
  size: number;
  prices: { price: number; book: number; sections: number[] }[];
}

const CONSUMABLE_NAME =
  /potion|tincture|elixir|\boil\b|berries|herbs?\b|laumspur|salve|draught|ointment|antidote|powder/i;

/** Un objet de liste de prix est-il un consommable ? (effet connu, indication du livre, ou nom typique). */
export function isConsumable(name: string, note?: string): boolean {
  const effect = itemEffect(name);
  return !!(effect?.heal || effect?.buff || note || CONSUMABLE_NAME.test(name));
}

/** Les consommables d'un ensemble de livres, regroupés par nom ; ceux dont l'application connaît l'effet y figurent même sans prix. */
export function buildLexicon(
  books: readonly { number: number; records: readonly PriceRecord[] }[],
): Consumable[] {
  const byName = new Map<string, Consumable>();
  const entry = (name: string): Consumable => {
    const key = name.toLowerCase();
    let found = byName.get(key);
    if (!found) {
      const effect = itemEffect(name);
      found = {
        name,
        notes: [],
        size: itemSize(name),
        prices: [],
        ...(effect?.heal ? { heal: effect.heal } : {}),
        ...(effect?.buff ? { combatSkill: effect.buff.combatSkill } : {}),
      };
      byName.set(key, found);
    }
    return found;
  };
  for (const name of ['Potion of Laumspur', 'Healing Potion', 'Alether Berries']) entry(name);
  for (const book of books) {
    for (const r of book.records) {
      if (!isConsumable(r.name, r.effect)) continue;
      const c = entry(r.name);
      if (r.effect && !c.notes.includes(r.effect)) c.notes.push(r.effect);
      const same = c.prices.find((p) => p.price === r.price && p.book === book.number);
      if (same) {
        if (!same.sections.includes(r.section)) same.sections.push(r.section);
      } else c.prices.push({ price: r.price, book: book.number, sections: [r.section] });
    }
  }
  return [...byName.values()]
    .map((c) => ({ ...c, prices: c.prices.sort((a, b) => a.book - b.book || a.price - b.price) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
