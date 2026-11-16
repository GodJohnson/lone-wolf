/**
 * Nettoyage par liste blanche du HTML issu du zip importé.
 *
 * Le zip vient d'un fichier choisi par l'utilisateur : son contenu est considéré comme non fiable.
 * Seuls les éléments et attributs listés ici sont conservés ; tout le reste (scripts, styles,
 * gestionnaires d'événements, iframes...) est supprimé. Angular applique en plus son propre
 * assainissement au rendu via `[innerHTML]` (défense en profondeur).
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'b',
  'i',
  'em',
  'strong',
  'span',
  'a',
  'cite',
  'sup',
  'sub',
  'small',
  'abbr',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** Éléments supprimés avec tout leur contenu. */
const DROPPED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'svg',
  'math',
  'img',
  'figure',
  'noscript',
  'template',
]);

const ALLOWED_CLASSES = new Set([
  'smallcaps',
  'choice',
  'combat',
  'deadend',
  'signpost',
  'footnote',
]);

/** Liens conservés : pages internes du livre (`sect12.htm`, `random.htm`...) et http(s). */
const SAFE_HREF = /^(?:[a-z0-9_-]+\.htm(?:#[\w-]*)?|https?:\/\/[^\s"'<>]+)$/i;

export function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROPPED_TAGS.has(tag)) {
    return null;
  }
  // Élément inconnu (div, section, font...) : on garde uniquement son contenu.
  const target: Node = ALLOWED_TAGS.has(tag)
    ? doc.createElement(tag)
    : doc.createDocumentFragment();
  if (target instanceof Element) {
    copySafeAttributes(el, target, tag);
  }
  for (const child of Array.from(el.childNodes)) {
    const cleaned = cleanNode(child, doc);
    if (cleaned) target.appendChild(cleaned);
  }
  return target;
}

function copySafeAttributes(source: Element, target: Element, tag: string): void {
  const classes = (source.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter((c) => ALLOWED_CLASSES.has(c));
  if (classes.length) target.setAttribute('class', classes.join(' '));

  if (tag === 'a') {
    const href = source.getAttribute('href')?.trim();
    if (href && SAFE_HREF.test(href)) target.setAttribute('href', href);
  }
  if (tag === 'td' || tag === 'th') {
    for (const attr of ['colspan', 'rowspan']) {
      const value = source.getAttribute(attr);
      if (value && /^\d{1,2}$/.test(value)) target.setAttribute(attr, value);
    }
  }
}

/** HTML interne nettoyé d'un élément (sans la balise englobante). */
export function cleanInnerHtml(el: Element): string {
  const doc = el.ownerDocument;
  const wrapper = doc.createElement('div');
  for (const child of Array.from(el.childNodes)) {
    const cleaned = cleanNode(child, doc);
    if (cleaned) wrapper.appendChild(cleaned);
  }
  return wrapper.innerHTML.trim();
}

/** HTML nettoyé d'un élément, balise englobante comprise. */
export function cleanOuterHtml(el: Element): string {
  const doc = el.ownerDocument;
  const wrapper = doc.createElement('div');
  const cleaned = cleanNode(el, doc);
  if (cleaned) wrapper.appendChild(cleaned);
  return wrapper.innerHTML.trim();
}

/** Texte normalisé : espaces insécables et blancs multiples ramenés à un espace. */
export function normalizedText(el: Element): string {
  return (el.textContent ?? '').replace(/[\s  ]+/g, ' ').trim();
}
