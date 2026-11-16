import { strToU8, Unzipped } from 'fflate';

/**
 * Livre factice reproduisant la structure XHTML de Project Aon, avec un texte inventé.
 * Aucun contenu réel des livres ne doit être versionné (licence Project Aon).
 */
export function fakePage(body: string, title = 'The Test Book'): string {
  return `<!DOCTYPE html SYSTEM "about:legacy-compat">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-GB">
<head><title>${title}</title><script src="https://example.invalid/evil.js"></script></head>
<body><div class="container">
  <header id="main-header"><h1>${title}</h1><h2>Jane Author</h2></header>
  <article><div class="numbered"><div class="maintext">${body}</div><p id="page-navigation"></p></div></article>
  <footer><div id="license"><p>Text &copy; 2026 Jane Author.</p></div></footer>
</div></body></html>`;
}

export const FAKE_SECTION_1 = fakePage(`
  <h3>1</h3>
  <p>The fog lies <span class="smallcaps">thick</span> on the &eacute;cole road.</p>
  <figure><a href="ill1.htm"><img alt="illustration" src="ill1.png"/></a></figure>
  <p class="combat">Fog Beast: <span class="smallcaps">COMBAT&nbsp;SKILL</span>&nbsp;14 &nbsp;&nbsp;<span class="smallcaps">ENDURANCE</span>&nbsp;20</p>
  <p>Pick a number from the <a href="random.htm">Random Number Table</a>.</p>
  <p class="choice">If you pick 0&ndash;4, <a href="sect2.htm">turn to 2</a>.</p>
  <p class="choice">If you pick 5&ndash;9, <a href="sect3.htm">turn to 3</a>.</p>
`);

export function fakeBookZip(code = '99test'): Unzipped {
  const dir = `en/xhtml/lw/${code}/`;
  return {
    [`${dir}sect1.htm`]: strToU8(FAKE_SECTION_1),
    [`${dir}sect2.htm`]: strToU8(fakePage('<h3>2</h3><p class="deadend">The road ends here.</p>')),
    [`${dir}sect3.htm`]: strToU8(fakePage('<h3>3</h3><p>You made it.</p>')),
    [`${dir}toc.htm`]: strToU8(
      fakePage(
        '<h2>Contents</h2><ul><li><a href="gamerulz.htm">Rules</a></li><li><a href="discplnz.htm">Disciplines</a></li><li><a href="numbered.htm">Numbered</a></li></ul>',
      ),
    ),
    [`${dir}gamerulz.htm`]: strToU8(fakePage('<h2>The Rules</h2><p>Be brave.</p>')),
    [`${dir}discplnz.htm`]: strToU8(
      fakePage(
        '<h3>Disciplines</h3><h4><a id="a">Fogsight</a></h4><p>…</p><h4><a id="b">Healing</a></h4><p>…</p>',
      ),
    ),
    [`${dir}ill1.png`]: new Uint8Array([137, 80, 78, 71]),
    [`${dir}ill1.htm`]: strToU8(fakePage('<figure><img src="ill1.png"/></figure>')),
  };
}
