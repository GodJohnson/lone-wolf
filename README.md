# Lone Wolf Reader

Application web **mobile-first** (Angular 22, PWA) pour jouer aux livres-jeux *Loup Solitaire* (*Lone Wolf*) de Joe Dever, à partir des éditions gratuites publiées par [Project Aon](https://www.projectaon.org/).

## Principe : le joueur importe ses livres

La [licence Project Aon](https://www.projectaon.org/en/Main/License) autorise le téléchargement pour un usage personnel mais **interdit la redistribution** des textes et illustrations, y compris leur affichage sur un autre site. En outre, projectaon.org n'envoie pas d'en-têtes CORS : une appli hébergée ailleurs ne peut pas lire ses fichiers.

Conséquence :

- ni le dépôt ni le site ne contiennent de texte des livres (`*.zip` est dans `.gitignore`, les fixtures de test sont inventées) ;
- le joueur télécharge le zip officiel d'un livre (lien direct dans l'appli), puis l'importe ;
- le livre est converti et stocké **uniquement dans le navigateur** (IndexedDB) et reste jouable hors ligne.

Seuls l'anglais et l'espagnol sont publiés par Project Aon. L'interface est bilingue FR/EN ; le texte du livre reste dans la langue du zip.

## Fonctionnalités (v0.1)

- Bibliothèque : import d'un zip, catalogue des 29 livres avec liens de téléchargement.
- Création du personnage : tirages HABILETÉ / ENDURANCE, choix des disciplines (lues dans le livre), arme de Weaponskill, équipement de départ guidé (livres 1 à 5).
- Lecture section par section, choix en gros boutons, illustrations, pages de règles et annexes.
- Feuille d'aventure : caractéristiques, disciplines, inventaire avec capacités (2 armes, 8 places de sac à dos Repas compris, 50 couronnes), effets des objets (Helmet, Chainmail, Shield), potions à boire, notes.
- Repas : quand le texte l'impose, l'appli propose de manger un Repas, de chasser ou de perdre 3 END.
- Combat : quotient d'attaque calculé (Weaponskill +2, Mindblast +2, sans arme −4, modificateur de section), table des résultats, fuite, journal des assauts.
- Table de hasard (tirage cryptographique 0-9), Guérison automatique (+1 END par section sans combat).
- Sauvegarde automatique à chaque action, retour à la section précédente, PWA installable.

## Développement

```bash
npm ci
npm start          # http://localhost:4200
npm test           # tests unitaires (Vitest)
npx ng build       # build de production dans dist/lone-wolf/browser
```

Pour tester, téléchargez par exemple <https://www.projectaon.org/en/xhtml/lw/01fftd/01fftd.zip> et importez-le. **Ne committez jamais ce fichier.**

## Déploiement

Le workflow `.github/workflows/deploy.yml` lance les tests et le build sur chaque PR, puis déploie sur GitHub Pages à chaque push sur `main`.

Prérequis, une seule fois : *Settings → Pages → Build and deployment → Source : GitHub Actions*.

Le routage utilise le hash (`/#/book/...`), car GitHub Pages ne sait pas réécrire les URL profondes.

## Architecture

```
src/app/
  core/
    book/      import du zip (fflate), parseur XHTML → blocs, nettoyage HTML par liste blanche, catalogue
    game/      modèles, règles (séries, combat, guérison), table des résultats de combat, tirage
    storage/   schéma IndexedDB (idb) : books, sections, pages, images, games
    i18n/      service de traduction à signal + dictionnaires FR/EN typés
  features/    library, new-game, reader (+ combat), action-chart, page (règles/annexes)
  shared/      top-bar, rendu des blocs, illustrations, table de hasard
```

- Le contenu importé est considéré comme **non fiable** : il est nettoyé par liste blanche à l'import (`html-cleaner.ts`, sans script, style, attribut d'événement ni lien `javascript:`), puis à nouveau par Angular au rendu (`[innerHTML]`).
- Garde-fous à l'import : taille du zip ≤ 50 Mo, décompressé ≤ 150 Mo, seuls `.htm` et les images sont extraits.
- i18n maison plutôt que `@angular/localize` : changement de langue à chaud, sans un build par langue.

## Dette technique et limites connues

- **Table des résultats de combat et équipement de départ retranscrits dans le code** (`combat-results-table.ts`) : le zip ne la fournit qu'en image. C'est une donnée de mécanique, pas du texte, mais le point reste à garder en tête vis-à-vis de la licence.
- **Seules les règles de la série Kaï (livres 1 à 5) sont vérifiées.** Pour Magnakaï, Grand Maître et Nouvel Ordre, les valeurs de création (`SERIES_RULES`) sont des défauts signalés comme non vérifiés dans l'UI, et les disciplines avancées n'ont pas d'effet automatique.
- L'équipement de départ n'est guidé que pour les livres 1 à 5 (données relevées dans `core/game/equipment.ts`). Pour les autres livres, il se saisit à la main.
- Les objets trouvés en cours de lecture s'ajoutent à la main sur la Feuille d'aventure (avec suggestions).
- Pas de transfert de personnage d'un livre à l'autre.
- Les effets spécifiques à une section (perte d'END, objets gagnés, ennemis insensibles à Mindblast…) sont appliqués par le joueur.
- Pas encore de tests de composants ni de tests e2e versionnés.

## Documentation

- Technique : [architecture](docs/technique/architecture.md), [données](docs/technique/donnees.md), [exploitation](docs/technique/exploitation.md), [ADR](docs/technique/adr/)
- Fonctionnelle : [import d'un livre](docs/fonctionnel/bibliotheque/import-livre.md), [partie](docs/fonctionnel/jeu/partie.md), [glossaire](docs/fonctionnel/glossaire.md)
- Avant une PR : `bash tools/sic-doc/controler-doc.sh`
