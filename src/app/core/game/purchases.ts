/**
 * Détection des achats dans le texte d'une section. Trois formes, toutes lues dans les livres 2, 4 et 5 :
 *  - lignes de prix d'une boutique : « Sword—4 Gold Crowns » (éléments de liste) ;
 *  - phrases d'achat d'un objet : « If you wish to buy the waistcoat, pay the man 5 Gold Crowns » ;
 *  - choix payants : « If you wish to ride inside, pay the driver 3 Gold Crowns and turn to 37 ».
 * Volontairement prudent : toute forme non reconnue reste à la main (déclaration par sélection).
 */
export interface PriceLine {
  name: string;
  price: number;
  /** Indication entre parenthèses du livre (« restores 4 ENDURANCE points »), si elle existe. */
  effect?: string;
  /** Position du nom dans le texte de la ligne (pour y poser le lien). */
  start: number;
  end: number;
}

export interface BuySentence {
  name: string;
  price: number;
  /** Position de « N Gold Crowns » dans la phrase (pour y poser le lien). */
  start: number;
  end: number;
}

/** « Sword—4 Gold Crowns » (tiret) ou « Swords 4 Gold Crowns each » (pluriel, sans tiret). */
const PRICE_LINE =
  /^\s*([A-Z][^—–(]*?)\s*(?:\(([^)]*)\))?\s*(?:[—–-]\s*(\d+)\s+Gold\s+Crowns?(\s+each)?|(\d+)\s+Gold\s+Crowns?(\s+each))\s*\d*\s*$/;
const WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const AMOUNT = String.raw`(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)`;
const GOLD = new RegExp(String.raw`\b${AMOUNT}\s+Gold\s+Crowns?\b`, 'gi');

function amount(word: string): number {
  return /^\d+$/.test(word) ? Number(word) : (WORDS[word.toLowerCase()] ?? 0);
}

/** « Swords » → « Sword », « Quarterstaves » → « Quarterstaff » (lignes « … each »). */
function singularName(name: string): string {
  if (/staves$/i.test(name)) return name.replace(/staves$/i, 'staff');
  return /s$/i.test(name) && !/ss$/i.test(name) ? name.slice(0, -1) : name;
}
const NEGATION = /\b(?:do not|don't|cannot|can't|unable|refuse|decline|will not|won't)\b/i;
const WISH = /\b(?:wish|want|would like|would prefer|decide|choose|prefer)\b/i;
const BUY =
  /\b(?:buy|purchase)\s+(?:the |a |an |some |any |one of the )?([^,.;:]+?)(?:\s+(?:from|for|at|with)\b[^,.;:]*)?\s*(?:,|\.|;|$|\bpay\b)/i;

/** « Sword—4 Gold Crowns », « Potion of Laumspur (restores 4 …)—5 Gold Crowns », « Swords—5 Gold Crowns each ». */
export function parsePriceLine(text: string): PriceLine | null {
  const clean = text.replace(/[\s ]+/g, ' ').trim();
  const m = PRICE_LINE.exec(clean);
  if (!m) return null;
  let name = m[1].trim();
  if (m[4] || m[6]) name = singularName(name); // « … each » : un seul objet
  if (!name || name.length > 60) return null;
  const price = Number(m[3] ?? m[5]);
  if (!(price >= 1 && price <= 999)) return null;
  const start = text.indexOf(m[1].trim());
  const effect = m[2]?.trim();
  return { name, price, start, end: start + m[1].trim().length, ...(effect ? { effect } : {}) };
}

/** Phrase d'achat d'un objet par le joueur ; `null` pour les refus, les ventes par un autre et les services. */
export function parseBuySentence(sentence: string): BuySentence | null {
  const buy = BUY.exec(sentence);
  if (!buy || !WISH.test(sentence.slice(0, buy.index + 1))) return null;
  if (NEGATION.test(sentence.slice(0, buy.index))) return null;
  GOLD.lastIndex = buy.index;
  const gold = GOLD.exec(sentence);
  if (!gold) return null;
  const name = buy[1].trim().replace(/\s+/g, ' ');
  if (!name || name.length > 50) return null;
  return {
    name: name[0].toUpperCase() + name.slice(1),
    price: amount(gold[1]),
    start: gold.index,
    end: gold.index + gold[0].length,
  };
}

const COST = new RegExp(
  String.raw`^\s*(?:[Aa]n?|[Oo]ne|[Tt]he)?\s*(?:(?:handful|bunch|dose|vial|flask|bottle|portion)s?\s+of\s+)?([A-Z][A-Za-z' -]{2,40}?)\s+costs?\s+${AMOUNT}\s+Gold\s+Crowns?\b`,
);

/**
 * Phrase de prix d'un objet à acheter (« A handful of Alether Berries costs 3 Gold Crowns. »). À n'utiliser
 * que dans un paragraphe qui parle d'acheter (la phrase seule n'exprime pas l'achat).
 */
export function parseCostSentence(sentence: string): BuySentence | null {
  const m = COST.exec(sentence);
  if (!m) return null;
  const gold = new RegExp(GOLD.source, 'i').exec(sentence.slice(m.index));
  if (!gold) return null;
  const start = m.index + gold.index;
  return {
    name: m[1].trim().replace(/\s+/g, ' '),
    price: amount(m[2]),
    start,
    end: start + gold[0].length,
  };
}

/**
 * Prix d'un choix payant (« pay the driver 3 Gold Crowns and turn to 37 »), ou `null`.
 * Exclut les refus (« cannot afford to pay … »), et les cas où le joueur reçoit de l'argent.
 */
export function choicePayment(text: string): number | null {
  const clean = text.replace(/[\s ]+/g, ' ');
  const pay = new RegExp(
    String.raw`\bpay\b(?!\s+you\b)([^.]*?)\b${AMOUNT}\s+Gold\s+Crowns?\b`,
    'i',
  ).exec(clean);
  if (!pay) return null;
  const before = clean.slice(0, pay.index);
  if (NEGATION.test(before) || /\b(?:he|she|they|it|who|which|will)\s*$/i.test(before.trim()))
    return null;
  if (!/\bif you\b/i.test(before) && before.trim() !== '') return null;
  return amount(pay[2]) || null;
}

/** Prix de chaque choix payant d'une liste de blocs (`null` pour les autres blocs). */
export function paymentsOf(blocks: readonly { kind: string; html?: string }[]): (number | null)[] {
  return blocks.map((b) =>
    b.kind === 'choice' && b.html ? choicePayment(b.html.replace(/<[^>]+>/g, ' ')) : null,
  );
}

/** Prix proche d'une sélection dans un texte (« … 5 Gold Crowns » juste après ou avant), ou 0. */
export function guessPrice(source: string, selection: string): number {
  const at = source.indexOf(selection);
  if (at < 0) return 0;
  const after = source.slice(at + selection.length, at + selection.length + 80);
  const near = new RegExp(String.raw`^[^.;]*?\b${AMOUNT}\s+Gold\s+Crowns?\b`, 'i').exec(after);
  if (near) return amount(near[1]);
  const before = source.slice(Math.max(0, at - 60), at);
  const last = [...before.matchAll(new RegExp(GOLD.source, 'gi'))].pop();
  return last ? amount(last[1]) : 0;
}
