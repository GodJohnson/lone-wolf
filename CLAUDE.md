# CLAUDE.md — Lone Wolf Reader

## Contexte projet

Lecteur mobile-first (Angular 22 standalone, signaux, zoneless, PWA) des livres-jeux Loup Solitaire de Project Aon, hébergé sur GitHub Pages.

- `npm start` / `npm test` (Vitest) / `npx ng build`.
- **Licence Project Aon** : ne jamais versionner de texte, d'illustration ni de zip des livres. Les fixtures de test sont inventées (`src/testing/fake-book.ts`). Voir la section « Principe » du README.
- Tout le contenu importé est non fiable : passer par `core/book/html-cleaner.ts`.
- Libellés d'interface : `core/i18n/messages.ts` (FR fait référence, EN typé dessus).
- `.sic-doc.conf` n'est qu'un marqueur exigé par l'environnement de développement : ne pas le supprimer.
