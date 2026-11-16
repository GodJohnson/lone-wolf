import { Block, Enemy } from './book.models';
import { cleanInnerHtml, cleanOuterHtml, normalizedText } from './html-cleaner';

/**
 * Transforme une page XHTML Project Aon (`sectN.htm`, `gamerulz.htm`...) en blocs structurés.
 * Le parseur s'appuie sur les classes de la mise en page officielle (`maintext`, `choice`,
 * `combat`, `deadend`) et retombe sur un bloc HTML générique pour tout le reste.
 */

const SECTION_LINK = /^sect(\d+)\.htm$/i;
const COMBAT_STATS = /^(.*?):?\s*COMBAT\s*SKILL\s*:?\s*(\d+)\s*ENDURANCE\s*:?\s*(\d+)/i;
const CONTAINER_TAGS = new Set(['div', 'section', 'article']);

export function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function mainText(doc: Document): Element | null {
  return doc.querySelector('.maintext') ?? doc.querySelector('article') ?? doc.body;
}

/** Numéro de section, à partir du nom de fichier `sectN.htm`. */
export function sectionNumberFromFile(fileName: string): number | null {
  const match = SECTION_LINK.exec(fileName);
  return match ? Number(match[1]) : null;
}

/** Titre de la page (premier titre de `.maintext`). */
export function pageTitle(doc: Document): string {
  const heading = mainText(doc)?.querySelector('h1, h2, h3');
  return heading ? normalizedText(heading) : '';
}

/**
 * Découpe le contenu principal en blocs.
 * @param skipFirstHeading ignore le premier titre (le numéro de section, affiché par l'UI).
 */
export function parseBlocks(root: Element, skipFirstHeading = true): Block[] {
  const blocks: Block[] = [];
  let headingSkipped = !skipFirstHeading;

  const visit = (parent: Element): void => {
    for (const el of Array.from(parent.children)) {
      const tag = el.tagName.toLowerCase();

      if (!headingSkipped && /^h[1-6]$/.test(tag)) {
        headingSkipped = true;
        continue;
      }
      if (el.id === 'page-navigation') continue;

      if (tag === 'figure' || (tag === 'img' && el.getAttribute('src'))) {
        const image = imageName(el);
        if (image) blocks.push({ kind: 'figure', image });
        continue;
      }
      if (CONTAINER_TAGS.has(tag)) {
        visit(el);
        continue;
      }

      const classes = el.classList;
      if (tag === 'p' && classes.contains('choice')) {
        const target = choiceTarget(el);
        const html = cleanInnerHtml(el);
        blocks.push(
          target !== null
            ? { kind: 'choice', html, target }
            : { kind: 'html', html: `<p>${html}</p>` },
        );
        continue;
      }
      if (tag === 'p' && classes.contains('combat')) {
        blocks.push({
          kind: 'combat',
          html: cleanInnerHtml(el),
          enemy: parseEnemy(normalizedText(el)),
        });
        continue;
      }
      if (tag === 'p' && classes.contains('deadend')) {
        blocks.push({ kind: 'deadend', html: cleanInnerHtml(el) });
        continue;
      }

      const html = cleanOuterHtml(el);
      if (html) blocks.push({ kind: 'html', html });
    }
  };

  visit(root);
  return blocks;
}

export function parseEnemy(text: string): Enemy | null {
  const match = COMBAT_STATS.exec(text);
  if (!match) return null;
  return {
    name: match[1].trim(),
    combatSkill: Number(match[2]),
    endurance: Number(match[3]),
  };
}

function choiceTarget(el: Element): number | null {
  for (const a of Array.from(el.querySelectorAll('a[href]'))) {
    const n = sectionNumberFromFile(a.getAttribute('href') ?? '');
    if (n !== null) return n;
  }
  return null;
}

function imageName(el: Element): string | null {
  const img = el.tagName.toLowerCase() === 'img' ? el : el.querySelector('img');
  const src = img?.getAttribute('src') ?? '';
  // Nom de fichier simple uniquement : pas de chemin, pas d'URL externe.
  return /^[\w-]+\.(png|jpe?g|gif)$/i.test(src) ? src : null;
}

/** Noms des disciplines, lus dans les titres `h4` de `discplnz.htm`. */
export function parseDisciplines(doc: Document): string[] {
  const root = mainText(doc);
  if (!root) return [];
  return Array.from(root.querySelectorAll('h4'))
    .map((h) => normalizedText(h))
    .filter((name) => name.length > 0 && name.length < 60);
}

/** Pages listées dans la table des matières (`toc.htm`), hors sections numérotées. */
export function parseTableOfContents(doc: Document): { id: string; title: string }[] {
  const root = mainText(doc);
  if (!root) return [];
  const seen = new Set<string>();
  const result: { id: string; title: string }[] = [];
  for (const a of Array.from(root.querySelectorAll('a[href]'))) {
    const href = (a.getAttribute('href') ?? '').split('#')[0];
    const match = /^([a-z0-9_-]+)\.htm$/i.exec(href);
    if (!match || SECTION_LINK.test(href) || seen.has(match[1])) continue;
    seen.add(match[1]);
    result.push({ id: match[1], title: normalizedText(a) });
  }
  return result;
}
