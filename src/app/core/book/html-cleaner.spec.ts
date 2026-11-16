import { cleanOuterHtml } from './html-cleaner';

function clean(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return cleanOuterHtml(doc.body.firstElementChild!);
}

describe('html-cleaner', () => {
  it('supprime scripts, styles et gestionnaires d’événements', () => {
    expect(clean('<p onclick="x()">a<script>alert(1)</script><style>p{}</style>b</p>')).toBe(
      '<p>ab</p>',
    );
  });

  it('refuse les liens javascript: et data:', () => {
    expect(clean('<p><a href="javascript:alert(1)">x</a></p>')).toBe('<p><a>x</a></p>');
    expect(clean('<p><a href="data:text/html,x">x</a></p>')).toBe('<p><a>x</a></p>');
  });

  it('garde les liens internes et http(s)', () => {
    expect(clean('<p><a href="sect12.htm">x</a></p>')).toBe('<p><a href="sect12.htm">x</a></p>');
    expect(clean('<p><a href="https://www.projectaon.org/">x</a></p>')).toBe(
      '<p><a href="https://www.projectaon.org/">x</a></p>',
    );
  });

  it('ne garde que les classes autorisées et déballe les éléments inconnus', () => {
    expect(clean('<p class="smallcaps evil"><font color="red">x</font></p>')).toBe(
      '<p class="smallcaps">x</p>',
    );
  });

  it('supprime les images et iframes', () => {
    expect(clean('<p><img src="x" onerror="alert(1)"><iframe src="x"></iframe>ok</p>')).toBe(
      '<p>ok</p>',
    );
  });
});
