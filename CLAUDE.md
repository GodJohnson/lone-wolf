# CLAUDE.md — Lone Wolf Reader

<!-- sic-doc:begin v1 — bloc géré par la skill documentation-projet (sic-dev-toolkit). Ne pas éditer à la main : relancer initialiser-doc.sh --maj -->
## Documentation — règle obligatoire (Groupement SIC)

Toute modification livrable met à jour la documentation **dans le même changement** (même branche, même PR, même WI). Pas de PR sans doc à jour.

| Le changement touche… | Mettre à jour |
|---|---|
| Un endpoint, un contrat, un DTO exposé | `docs/technique/api/openapi.yaml` (régénéré, jamais écrit à la main) + la fiche fonctionnelle |
| Le schéma SQL, une procédure stockée, une migration | `docs/technique/donnees.md` |
| Une règle de gestion, un comportement métier | La fiche `docs/fonctionnel/<domaine>/<fonctionnalité>.md` (règles `RG-…` + scénarios Gherkin) |
| Un choix d'architecture, une dépendance structurante | Un ADR `docs/technique/adr/NNNN-titre.md` |
| Le déploiement, la configuration, la supervision | `docs/technique/exploitation.md` |
| Le démarrage / l'usage du projet | `README.md` |

**Avant d'ouvrir une PR** : `bash tools/sic-doc/controler-doc.sh` doit être vert (le build de validation exécute le même contrôle).

**Échappatoire** : un commit avec le trailer `Docs: n/a — <raison réelle>` pour un changement sans effet documentaire. Exception auditée, jamais un défaut.

**Doc fonctionnelle** :
- Front-matter obligatoire : `wi` (AB#id), `statut`, `donnees_sensibles`.
- Une règle de gestion que tu déduis du code sans confirmation métier est marquée `à valider` : ne jamais l'inventer ni la présenter comme actée. En cas d'ambiguïté métier SDIS, poser la question.
- Tu poses `statut: brouillon` ou `a-valider`. `statut: valide` est réservé à un humain nommé.

**Garde-fous** : aucune donnée réelle (victime, agent, matricule, bilan) dans la doc, les scénarios ou les exemples — données factices uniquement ; aucun secret ni chaîne de connexion ; aucun nom de serveur/hôte/partage interne (faits d'infra → fichier pointé par `SIC_INFRA_MAP`, jamais dans le dépôt) ; `donnees_sensibles` : en cas de doute, `a-qualifier`.

Détail, gabarits et procédure : skill `sic-dev-toolkit:documentation-projet`.
<!-- sic-doc:end -->

## Contexte projet

Lecteur mobile-first (Angular 22 standalone, signaux, zoneless, PWA) des livres-jeux Loup Solitaire de Project Aon, hébergé sur GitHub Pages.

- `npm start` / `npm test` (Vitest) / `npx ng build`.
- **Licence Project Aon** : ne jamais versionner de texte, d'illustration ni de zip des livres. Les fixtures de test sont inventées (`src/testing/fake-book.ts`). Voir `docs/technique/adr/0001-import-des-livres-par-le-joueur.md`.
- Tout le contenu importé est non fiable : passer par `core/book/html-cleaner.ts`.
- Libellés d'interface : `core/i18n/messages.ts` (FR fait référence, EN typé dessus).
- Base de comparaison du contrôle de doc : `origin/main`.
