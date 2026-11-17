import { Block } from '../book/book.models';
import { ItemSlot } from './equipment';

/**
 * Repérage des objets ramassables dans le texte d'une section, pour les rendre cliquables.
 *
 * Les livres écrivent les objets avec des majuscules (« you discover a Giak Spear… You may keep
 * this Weapon »). La détection est heuristique : uniquement dans les paragraphes qui parlent de
 * prendre ou de garder quelque chose, uniquement après un article ou un nombre, et jamais dans
 * une phrase de perte (« erase », « lose »…). Le joueur confirme toujours avant l'ajout : une
 * fausse détection ne coûte qu'un lien en trop.
 */
export type FoundItem =
  | { kind: 'item'; name: string; slot: ItemSlot }
  | { kind: 'gold'; amount: number; label: string }
  | { kind: 'meals'; count: number; label: string };

export interface AnnotatedBlocks {
  blocks: Block[];
  items: FoundItem[];
}

/** Préfixe des liens générés : `#item-<index>`. */
export const ITEM_LINK_PREFIX = '#item-';

const TAKE_PARAGRAPH =
  /\b(?:may|can|might) (?:also )?(?:keep|take)\b|\bif you (?:wish|decide|want) to (?:keep|take|buy|purchase|accept|put on)\b|\b(?:mark|record|note)\b[^.]*\bAction Chart\b|\b(?:Special|Backpack) Items?\b|\bif you wish\b/i;
const LOSS_SENTENCE =
  /\b(?:erase|remove|lose|lost|stolen|steal|discard|confiscat\w*|exchange|give|pay|fee|cost|demand\w*|bribe)\b/i;

const NUMBER_WORDS: Record<string, number> = {
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
const WEAPON_NOUNS = new Set([
  'axe',
  'broadsword',
  'bow',
  'dagger',
  'mace',
  'quarterstaff',
  'spear',
  'sword',
  'warhammer',
]);
/** Noms d'objets courants, jamais exclus par le lexique même s'ils apparaissent sans article. */
const ITEM_NOUNS = new Set([
  ...WEAPON_NOUNS,
  'laumspur',
  'potion',
  'gem',
  'key',
  'scroll',
  'map',
  'rope',
  'torch',
  'tinderbox',
  'pass',
  'helmet',
  'shield',
  'chainmail',
  'herb',
  'flask',
  'vial',
  'whistle',
  'medallion',
]);
/** Mots capitalisés qui ne désignent pas des objets à ramasser. */
const STOP_WORDS = new Set(
  [
    'action',
    'chart',
    'backpack',
    'backpacks',
    'belt',
    'pouch',
    'weapon',
    'weapons',
    'special',
    'item',
    'items',
    'meal',
    'meals',
    'gold',
    'crown',
    'crowns',
    'kai',
    'lord',
    'lords',
    'darklord',
    'darklords',
    'king',
    'giak',
    'giaks',
    'kraan',
    'lone',
    'wolf',
    'book',
    'books',
    'edition',
    'note',
    'random',
    'number',
    'table',
    'discipline',
    'disciplines',
    'magnakai',
    'combat',
    'skill',
    'endurance',
  ].map((w) => w.toLowerCase()),
);

const ARTICLE = String.raw`\b(a|an|the|this|these|some|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+`;
const CAPITALIZED = String.raw`([A-Z][a-z’'-]+(?:\s+(?:of\s+)?[A-Z][a-z’'-]+){0,3})`;
const ITEM_PATTERN = new RegExp(ARTICLE + CAPITALIZED, 'g');
const GOLD_PATTERN =
  /\b(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+Gold\s+Crowns?\b/gi;
const MEALS_PATTERN = /\b(?:enough food for\s+)?(\d+|a|one|two|three|four|five)\s+Meals?\b/gi;

/**
 * Annote les blocs HTML d'une section et retourne les objets détectés (index = numéro de lien).
 * @param nonItemWords mots (minuscules) qui ne sont pas des objets : créatures, lieux, peuples,
 *   disciplines du livre (voir `buildNonItemLexicon`).
 */
export function annotateItems(
  blocks: readonly Block[],
  nonItemWords: readonly string[] = [],
): AnnotatedBlocks {
  const items: FoundItem[] = [];
  const lexicon = new Set(nonItemWords);
  const annotated = blocks.map((block) => {
    if (block.kind !== 'html' || !/^<p[\s>]/.test(block.html)) return block;
    const html = annotateParagraph(block.html, items, lexicon);
    return html === block.html ? block : { ...block, html };
  });
  return { blocks: annotated, items };
}

function annotateParagraph(html: string, items: FoundItem[], lexicon: Set<string>): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const paragraph = doc.body.firstElementChild;
  if (!paragraph) return html;
  const text = paragraph.textContent ?? '';
  if (!TAKE_PARAGRAPH.test(text)) return html;

  const sentences = splitSentences(text);
  const matches: { start: number; end: number; item: FoundItem }[] = [];

  for (const sentence of sentences) {
    if (LOSS_SENTENCE.test(sentence.text)) continue;
    const context = sentence.text + ' ' + (sentences[sentence.index + 1]?.text ?? '');
    collect(
      GOLD_PATTERN,
      sentence,
      (m) => {
        const amount = toNumber(m[1]);
        return amount ? { kind: 'gold', amount, label: m[0] } : null;
      },
      matches,
    );
    collect(
      MEALS_PATTERN,
      sentence,
      (m) => {
        const count = toNumber(m[1]);
        return count ? { kind: 'meals', count, label: m[0] } : null;
      },
      matches,
    );
    collect(
      ITEM_PATTERN,
      sentence,
      (m) => {
        const name = m[2].replace(/\s+/g, ' ');
        if (!isItemName(name, lexicon)) return null;
        return { kind: 'item', name, slot: guessSlot(name, context) };
      },
      matches,
      (m) => m[0].length - m[2].length,
    );
  }
  if (!matches.length) return html;

  // Pas de chevauchement (ex. « 6 Gold Crowns » déjà pris) : on garde le premier trouvé.
  matches.sort((a, b) => a.start - b.start);
  const kept = matches.filter((m, i) => i === 0 || m.start >= matches[i - 1].end);
  wrapRanges(
    paragraph,
    kept.map((m) => ({ ...m, index: items.push(m.item) - 1 })),
  );
  return paragraph.outerHTML;
}

function collect(
  pattern: RegExp,
  sentence: { text: string; offset: number },
  build: (m: RegExpExecArray) => FoundItem | null,
  out: { start: number; end: number; item: FoundItem }[],
  /** Décalage du début du lien dans la correspondance (pour ne pas souligner l'article). */
  skip: (m: RegExpExecArray) => number = () => 0,
): void {
  pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(sentence.text))) {
    const item = build(m);
    if (!item) continue;
    const start = sentence.offset + m.index + skip(m);
    out.push({ start, end: sentence.offset + m.index + m[0].length, item });
  }
}

function isItemName(name: string, lexicon: Set<string>): boolean {
  if (/[’']s?$/.test(name)) return false; // possessif : « the Giak’s pouch »
  const words = name.toLowerCase().split(' ');
  const head = words[0];
  const last = words[words.length - 1];
  if (head === 'kai') return false; // « Kai Discipline of… », « Kai Rank of… »
  if (words.every((w) => STOP_WORDS.has(w) || w === 'of')) return false;
  if (STOP_WORDS.has(last)) return false;
  // Créature, lieu ou discipline : exclu, sauf s'il qualifie un objet connu (« Giak Spear »).
  const lastIsWeapon = WEAPON_NOUNS.has(last.replace(/s$/, ''));
  if (lexicon.has(last) || lexicon.has(singular(last))) return false;
  if (!lastIsWeapon && (lexicon.has(head) || lexicon.has(singular(head)))) return false;
  return true;
}

function singular(word: string): string {
  return word.endsWith('s') ? word.slice(0, -1) : word;
}

const ARTICLE_LIKE = new Set([
  'a',
  'an',
  'the',
  'this',
  'these',
  'that',
  'those',
  'some',
  'any',
  'your',
  'his',
  'her',
  'their',
  'its',
  'my',
  'another',
  'each',
  'every',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'both',
  'either',
  'no',
]);

/**
 * Construit, à partir de tout le livre, la liste des mots capitalisés qui ne sont pas des objets :
 * noms des ennemis (blocs de combat), disciplines, et mots employés sans article en début de groupe
 * capitalisé au moins deux fois (lieux, peuples, personnages : « to Holmgard », « by Giaks »).
 */
export function buildNonItemLexicon(
  sections: readonly { blocks: readonly Block[] }[],
  disciplines: readonly string[],
): string[] {
  const words = new Set<string>();
  for (const d of disciplines) for (const w of d.toLowerCase().split(/\s+/)) words.add(w);
  const bare = new Map<string, number>();

  for (const section of sections) {
    for (const block of section.blocks) {
      if (block.kind === 'combat' && block.enemy) {
        for (const w of block.enemy.name.split(/\s+/)) {
          if (/^[A-Z]/.test(w)) words.add(singular(w.toLowerCase().replace(/[’']s$/, '')));
        }
      }
      if (!('html' in block)) continue;
      const text = block.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
      const re = /([A-Za-z’'-]+)[\s,]+([A-Z][a-z’'-]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const previous = m[1];
        if (
          /^[A-Z]/.test(previous) ||
          ARTICLE_LIKE.has(previous.toLowerCase()) ||
          /^\d+$/.test(previous)
        ) {
          re.lastIndex = m.index + m[1].length;
          continue;
        }
        const word = singular(m[2].toLowerCase().replace(/[’']s$/, ''));
        bare.set(word, (bare.get(word) ?? 0) + 1);
        re.lastIndex = m.index + m[1].length;
      }
    }
  }
  for (const [word, count] of bare) if (count >= 2) words.add(word);
  for (const w of ITEM_NOUNS) words.delete(w);
  for (const w of STOP_WORDS) words.delete(w);
  return [...words].sort();
}

export function guessSlot(name: string, context: string): ItemSlot {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const near = new RegExp(`${escaped}[^.]*?\\b(Special|Backpack) Item`, 'i').exec(context);
  if (near) return near[1].toLowerCase() === 'special' ? 'specialItems' : 'backpack';
  const last = name.toLowerCase().split(' ').pop()!.replace(/s$/, '');
  if (WEAPON_NOUNS.has(last)) return 'weapons';
  if (/\bSpecial Item\b/i.test(context) && !/\bBackpack Item\b/i.test(context))
    return 'specialItems';
  return 'backpack';
}

function toNumber(word: string): number {
  return /^\d+$/.test(word) ? Number(word) : (NUMBER_WORDS[word.toLowerCase()] ?? 0);
}

function splitSentences(text: string): { text: string; offset: number; index: number }[] {
  const result: { text: string; offset: number; index: number }[] = [];
  const re = /[^.!?]+[.!?]*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) result.push({ text: m[0], offset: m.index, index: result.length });
  return result;
}

/** Entoure des plages du texte (offsets dans `textContent`) de liens `#item-N`, sans casser le balisage. */
function wrapRanges(root: Element, ranges: { start: number; end: number; index: number }[]): void {
  const doc = root.ownerDocument;
  for (const range of [...ranges].reverse()) {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const length = node.data.length;
      const start = range.start - offset;
      // La plage doit tenir dans un seul nœud texte (cas courant) ; sinon on renonce au lien.
      if (start >= 0 && start < length) {
        const end = range.end - offset;
        if (end <= length && !node.parentElement?.closest('a')) {
          const target = node.splitText(start);
          target.splitText(end - start);
          const link = doc.createElement('a');
          link.setAttribute('href', `${ITEM_LINK_PREFIX}${range.index}`);
          link.setAttribute('class', 'item-link');
          target.replaceWith(link);
          link.appendChild(target);
        }
        break;
      }
      offset += length;
    }
  }
}
