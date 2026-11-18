# Lone Wolf Reader

Application web **mobile-first** (Angular 22, PWA) pour jouer aux livres-jeux _Loup Solitaire_ (_Lone Wolf_) de Joe Dever, à partir des éditions gratuites publiées par [Project Aon](https://www.projectaon.org/).

## Principe : le joueur importe ses livres

La [licence Project Aon](https://www.projectaon.org/en/Main/License) autorise le téléchargement pour un usage personnel mais **interdit la redistribution** des textes et illustrations, y compris leur affichage sur un autre site. En outre, projectaon.org n'envoie pas d'en-têtes CORS : une appli hébergée ailleurs ne peut pas lire ses fichiers.

Conséquence :

- ni le dépôt ni le site ne contiennent de texte des livres (`*.zip` est dans `.gitignore`, les fixtures de test sont inventées) ;
- le joueur télécharge le zip officiel d'un livre (lien direct dans l'appli), puis l'importe ;
- le livre est converti et stocké **uniquement dans le navigateur** (IndexedDB) et reste jouable hors ligne.

Seuls l'anglais et l'espagnol sont publiés par Project Aon. L'interface est bilingue FR/EN ; le texte du livre reste dans la langue du zip, et le joueur peut le faire traduire par son navigateur.

## Fonctionnalités (v0.1)

- Bibliothèque : import d'un zip, catalogue des 29 livres avec liens de téléchargement.
- Création du personnage : tirages HABILETÉ / ENDURANCE, choix des disciplines (lues dans le livre), arme de Weaponskill, équipement de départ guidé (livres 1 à 5).
- Lecture section par section, choix en gros boutons, illustrations, pages de règles et annexes.
- Choix conditionnés par une discipline (« If you have the Kai Discipline of Tracking… ») : en vert si vous l'avez, grisés et inaccessibles sinon. Seules les formulations sans ambiguïté sont reconnues ; les conditions de rang Kaï ou d'objet restent des boutons normaux, et une section n'est jamais entièrement bloquée.
- Feuille d'aventure : caractéristiques, disciplines, inventaire avec capacités (2 armes, 8 places de sac à dos Repas compris, 50 couronnes), effets des objets (Helmet, Chainmail, Shield), potions à boire, notes.
- Objets ramassables : dans les paragraphes où l'on peut prendre quelque chose, les objets (« a Giak Spear »), l'or (« 6 Gold Crowns ») et les Repas deviennent des liens. Un toucher ouvre une confirmation : nom modifiable, emplacement deviné d'après le texte (arme, sac à dos, objet spécial), capacités respectées. Un lexique propre à chaque livre (ennemis, lieux, disciplines), complété par des termes classés à la main (`core/game/known-terms.ts`), écarte la plupart des faux positifs ; un lien erroné se retire d'un geste : « Pas ici » (cette section seulement, conservé en cas de réimport) ou « Pas un objet » (ce mot n'est plus jamais un lien, dans tous les livres). Les deux s'annulent depuis la Feuille d'aventure (« Liens d'objets retirés »).
- Armes : la fenêtre d'ajout indique l'effet pour votre personnage (arme ordinaire, ou arme maîtrisée +2 HAB, variantes comprises comme « Giak Spear » pour Spear) et propose « Laisser [arme] » quand vous en portez déjà deux ; la Feuille d'aventure rappelle la règle.
- Transfert de partie : « Transférer » sur la carte du livre affiche un QR code (et un lien à copier ou partager) qui contient la partie, compressée, sans le livre ; « Importer une partie » la reprend par scan caméra, lien collé ou lien ouvert, après validation stricte et confirmation. Fonctionne sans serveur, par exemple du téléphone vers le PC. Les notes sont limitées à 400 caractères dans le transfert, et le livre doit être importé sur l'autre appareil. Sur iPhone, scanner avec le bouton de l'appli plutôt que l'appareil photo (stockage séparé de Safari).
- Réception sans caméra (dans les deux sens) : « Recevoir sans caméra » affiche un QR code de réception ; l'autre appareil le scanne (« Importer une partie » ou « Transférer », puis « Scanner »), choisit la partie et l'envoie. Elle transite chiffrée (AES-GCM) par le relais public ntfy.sh : le relais ne voit qu'un message opaque sous un sujet aléatoire, la clé ne figure que dans le QR code (fragment du lien). Limites : dépendance à un service tiers gratuit (quotas, disponibilité), configurable par `RELAY_URL` dans `core/game/relay.ts` ; sans relais, le lien à coller reste possible.
- Création du personnage : les descriptions (disciplines, équipement) se consultent sans quitter le formulaire, dans une colonne latérale sur bureau et dans une feuille sur mobile ; la saisie en cours n'est jamais perdue. Les pages du livre ouvertes depuis la bibliothèque ou la lecture reviennent à la page précédente avec la flèche de retour.
- Panneaux et enseignes du livre (`div.signpost`) conservés à l'import, affichés dans un encadré. Les livres analysés avec une version plus ancienne affichent un avertissement dans la bibliothèque : réimporter le zip les met à jour sans toucher à la partie (`PARSER_VERSION`).
- Fin de livre : une section sans aucune suite affiche « Terminer le livre », qui marque le livre « Terminé » dans la bibliothèque et met « Continuer au livre suivant » en avant ; après une mort ou une fin d'aventure, « Retour à la bibliothèque » est proposé à côté de « Recommencer ».
- Série Kaï, livres 1 à 5 : « Continuer au livre N+1 » sur la carte d'un livre reprend le héros selon les règles du livre suivant. Reportés : HABILETÉ, ENDURANCE (remise à son total), disciplines, armes (on peut en laisser, 2 au maximum), objets spéciaux, notes et or (qui s'ajoute à l'or de départ, plafonné à 50). Non reportés : sac à dos et Repas. Le joueur choisit une discipline de plus, puis l'équipement de départ du nouveau livre ; les objets fixes déjà possédés ne sont pas dupliqués. La partie du livre précédent est conservée. Le livre 5 vers la série Magnakaï (livre 6) n'est pas géré.
- Version bureau (≥ 1024 px) : trois colonnes pendant la lecture. À gauche, la fiche du personnage (caractéristiques, disciplines, armes, sac, objets, avec ajout et suppression). Au centre, le texte. À droite, les objets de la section (ajout avec effet et remplacement d'arme, sans fenêtre flottante) et le lexique du livre (disciplines, équipement, règles, tables), consultable sans quitter la section.
- Repas : quand le texte l'impose, l'appli propose de manger un Repas, de chasser ou de perdre 3 END.
- Combat : quotient d'attaque calculé (Weaponskill +2, Mindblast +2, sans arme −4, modificateur de section), table des résultats, fuite, journal des assauts.
- Table de hasard (tirage cryptographique 0-9), Guérison automatique (+1 END par section sans combat).
- Lecture en français : la page de lecture déclare la langue du livre et exclut l'interface de la traduction, pour que la fonction « Traduire » du navigateur (Chrome, Safari) traduise uniquement le texte du livre.
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

Prérequis, une seule fois : _Settings → Pages → Build and deployment → Source : GitHub Actions_.

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

## Choix et pourquoi

- **Import par le joueur** : imposé par la licence Project Aon (voir « Principe »).
- **Site statique sur GitHub Pages, routage par `#`, PWA** : gratuit, sans serveur, jouable hors ligne. GitHub Pages ne réécrit pas les URL profondes, d'où le `#`. Pas de synchronisation entre appareils.
- **i18n maison à signal** (`core/i18n`) plutôt que `@angular/localize` : changement de langue à chaud, clés typées (une clé manquante en anglais ne compile pas).
- **Traduction des livres par le navigateur** : une traduction versionnée serait une œuvre dérivée, interdite par la licence, et aucune édition française n'est diffusée librement. Pendant la lecture, le document prend la langue du livre et l'interface est marquée `translate="no"` : seul le texte du livre est traduit par Chrome ou Safari. La traduction peut passer par les serveurs de Google ou d'Apple. Limite : elle n'est pas accessible depuis une appli ajoutée à l'écran d'accueil iOS (pas de barre Safari).

## Dette technique et limites connues

- **Table des résultats de combat et équipement de départ retranscrits dans le code** (`combat-results-table.ts`) : le zip ne la fournit qu'en image. C'est une donnée de mécanique, pas du texte, mais le point reste à garder en tête vis-à-vis de la licence.
- **Seules les règles de la série Kaï (livres 1 à 5) sont vérifiées.** Pour Magnakaï, Grand Maître et Nouvel Ordre, les valeurs de création (`SERIES_RULES`) sont des défauts signalés comme non vérifiés dans l'UI, et les disciplines avancées n'ont pas d'effet automatique.
- L'équipement de départ n'est guidé que pour les livres 1 à 5 (données relevées dans `core/game/equipment.ts`). Pour les autres livres, il se saisit à la main.
- La détection des objets est heuristique : il reste quelques faux liens (noms de lieux rares) et des oublis (objet cité sans article). La confirmation permet de corriger le nom ou de retirer le lien ; sinon, l'ajout manuel sur la Feuille d'aventure reste disponible.
- Pas de transfert de personnage d'un livre à l'autre.
- Les effets spécifiques à une section (perte d'END, objets gagnés, ennemis insensibles à Mindblast…) sont appliqués par le joueur.
- Pas encore de tests de composants ni de tests e2e versionnés.
