import { Block } from '../book/book.models';

/**
 * Reconnaissance des choix conditionnés par une discipline (« If you have the Kai Discipline of
 * Tracking, turn to 69 »). Volontairement conservateur : seules les formulations sans ambiguïté
 * sont reconnues ; tout le reste (rang Kaï, objets, « or if you do not wish… ») est `unknown`
 * et le choix reste utilisable normalement.
 */
export type ConditionStatus = 'met' | 'unmet' | 'unknown';

export interface ChoiceCondition {
  status: ConditionStatus;
  /** Disciplines en jeu (pour l'affichage). */
  disciplines: string[];
  /** Condition négative (« If you do not have… »). */
  negated: boolean;
  /** Rang Kaï exigé (« reached the Kai Rank of Guardian or higher »). */
  rank?: string;
}

const UNKNOWN: ChoiceCondition = { status: 'unknown', disciplines: [], negated: false };

const POSITIVE =
  /^if you (?:have|possess|possess and wish to use|wish to use|wish to demonstrate)(?: the| your)?(?: [\w-]+)* disciplines? of (either |both )?(.+?)(?: (?:to|on) .*)?$/i;

/** « If you have the Kai Discipline of Camouflage and have reached the Kai Rank of Guardian or higher ». */
const RANK_CLAUSE =
  /^if you (?:have|possess)(?: the| your)?(?: [\w-]+)* disciplines? of (.+?) and (?:have )?(?:you have )?reached the Kai Rank of (\w+)(?: or higher)?$/i;
const RANK_ONLY = /^if you (?:have )?reached the Kai Rank of (\w+)(?: or higher)?$/i;

/** Négation qui renvoie aux disciplines citées plus haut dans la section (« this », « the above »). */
const NEGATIVE_THIS =
  /^if you (?:do not|don't) (?:have|possess) this(?: [\w-]+)* (?:discipline|skill)$/i;
const NEGATIVE_ALL =
  /^if you (?:do not|don't) (?:have|possess) (?:these|either|either of these|any of these|the above|any of the above|either of the above)(?: [\w-]+)* (?:disciplines?|skills?)$|^if you possess neither of the above(?: [\w-]+)* disciplines$/i;

/** Négation explicite (« If you do not have the Kai Discipline of Tracking »). */
const NEGATIVE_EXPLICIT =
  /^if you (?:do not|don't) (?:have|possess)(?: the| either)?(?: [\w-]+)* disciplines? of (?:either )?(.+)$/i;

/**
 * Évalue les choix d'une section.
 * @returns une condition par bloc (même index), `null` pour les blocs qui ne sont pas des choix.
 */
export function evaluateChoices(
  blocks: readonly Block[],
  playerDisciplines: readonly string[],
  bookDisciplines: readonly string[],
  /** Rang du personnage (index dans `ranks`), `null` si les rangs de la série ne sont pas gérés. */
  rank: { index: number | null; ranks: readonly string[] } = { index: null, ranks: [] },
): (ChoiceCondition | null)[] {
  const owned = new Set(playerDisciplines.map((d) => d.toLowerCase()));
  const known = new Map(bookDisciplines.map((d) => [d.toLowerCase(), d]));
  const mentioned: string[] = [];
  let last: string[] = [];
  /** Un choix précédent parle de discipline sans être reconnu : les renvois deviennent incertains. */
  let tainted = false;

  const results = blocks.map((block): ChoiceCondition | null => {
    if (block.kind !== 'choice') return null;
    const clause = conditionClause(htmlToText(block.html));

    const ranked = RANK_CLAUSE.exec(clause) ?? RANK_ONLY.exec(clause);
    if (ranked) {
      const [, list, wanted] = ranked.length === 3 ? ranked : [ranked[0], null, ranked[1]];
      const needed = rank.ranks.findIndex((r) => r.toLowerCase() === wanted.toLowerCase());
      const names = list ? parseList(list, known) : { names: [], joiner: 'and' as const };
      if (needed < 0 || rank.index === null || !names) return UNKNOWN;
      mentioned.push(...names.names);
      last = names.names;
      const hasAll = names.names.every((d) => owned.has(d.toLowerCase()));
      return {
        status: hasAll && rank.index >= needed ? 'met' : 'unmet',
        disciplines: names.names,
        negated: false,
        rank: rank.ranks[needed],
      };
    }

    const positive = POSITIVE.exec(clause);
    if (positive) {
      const parsed = parseList(positive[2], known);
      if (!parsed) return UNKNOWN;
      const all = positive[1]?.toLowerCase().startsWith('both') || parsed.joiner === 'and';
      mentioned.push(...parsed.names);
      last = parsed.names;
      const has = (d: string) => owned.has(d.toLowerCase());
      const met = all ? parsed.names.every(has) : parsed.names.some(has);
      return { status: met ? 'met' : 'unmet', disciplines: parsed.names, negated: false };
    }

    // « this skill » renvoie à la dernière condition ; « these / the above / neither » à toutes.
    const reference = NEGATIVE_THIS.test(clause)
      ? last
      : NEGATIVE_ALL.test(clause)
        ? mentioned
        : null;
    if (reference) {
      if (!reference.length || tainted) return UNKNOWN;
      const unique = [...new Set(reference)];
      const met = !unique.some((d) => owned.has(d.toLowerCase()));
      return { status: met ? 'met' : 'unmet', disciplines: unique, negated: true };
    }

    const negative = NEGATIVE_EXPLICIT.exec(clause);
    if (negative) {
      const parsed = parseList(negative[1], known);
      if (!parsed) return UNKNOWN;
      const met = !parsed.names.some((d) => owned.has(d.toLowerCase()));
      return { status: met ? 'met' : 'unmet', disciplines: parsed.names, negated: true };
    }

    if (/disciplines?\b|skill|kai rank/i.test(clause)) tainted = true;
    return UNKNOWN;
  });

  // Filet de sécurité : si aucun choix n'est accessible, la reconnaissance s'est trompée.
  const choices = results.filter((r): r is ChoiceCondition => r !== null);
  if (choices.length && choices.every((r) => r.status === 'unmet')) {
    return results.map((r) => (r ? UNKNOWN : null));
  }
  return results;
}

/** Partie conditionnelle du choix : tout ce qui précède « turn to » ou « , you … ». */
export function conditionClause(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .split(/,?\s*\b(?:turn|turning)(?: immediately)? to\b/i)[0]
    .split(/,\s*you\b/i)[0]
    .replace(/[,.\s]+$/, '')
    .trim();
}

function parseList(
  list: string,
  known: Map<string, string>,
): { names: string[]; joiner: 'or' | 'and' } | null {
  const hasOr = /\bor\b/i.test(list);
  const hasAnd = /\band\b/i.test(list);
  if (hasOr && hasAnd) return null;
  const names = list
    .split(/\s*,\s*(?:or |and )?|\s+or\s+|\s+and\s+/i)
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => known.get(n.toLowerCase()));
  if (!names.length || names.some((n) => n === undefined)) return null;
  return { names: names as string[], joiner: hasAnd ? 'and' : 'or' };
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[lr]squo;|&#39;|’/g, "'");
}
