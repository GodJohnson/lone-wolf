---
wi: n/a
statut: a-valider
donnees_sensibles: non
---

# Ajouter un livre à sa bibliothèque

## Contexte et objectif

Le joueur doit pouvoir jouer à n'importe quel livre Loup Solitaire publié par Project Aon. La licence interdit à l'application d'héberger ou de redistribuer les livres : c'est le joueur qui télécharge le zip officiel, et l'application le convertit pour le rendre jouable sur mobile, y compris hors ligne.

## Acteurs et habilitations

| Acteur | Peut faire | Condition / rôle requis |
|---|---|---|
| Joueur | Importer, ré-importer, supprimer un livre ; consulter le catalogue | Aucune (application sans compte) |

## Règles de gestion

| ID | Énoncé | Source | Confirmation |
|---|---|---|---|
| RG-BIB-001 | L'application ne contient ni ne télécharge elle-même aucun texte ni illustration des livres ; le catalogue ne donne que des liens vers projectaon.org | Licence Project Aon §2.2, [ADR 0001](../../technique/adr/0001-import-des-livres-par-le-joueur.md) | à valider |
| RG-BIB-002 | Un zip est accepté s'il contient un fichier `sect1.htm` ; le dossier qui le contient détermine le code du livre | Structure des zips Project Aon | à valider |
| RG-BIB-003 | Un zip de plus de 50 Mo, ou de plus de 150 Mo une fois décompressé, est refusé | Garde-fou technique | à valider |
| RG-BIB-004 | Ré-importer un livre déjà présent remplace son contenu et conserve la partie en cours | Choix de conception | à valider |
| RG-BIB-005 | Supprimer un livre supprime aussi la partie associée, après confirmation | Choix de conception | à valider |
| RG-BIB-006 | La mention de copyright du livre est affichée sous chaque section | Licence Project Aon | à valider |

## Scénarios (Gherkin)

```gherkin
Fonctionnalité: Import d'un livre

  Scénario: Import d'un zip valide (RG-BIB-002)
    Etant donné un zip contenant "en/xhtml/lw/99test/sect1.htm"
    Quand le joueur importe ce zip
    Alors le livre "99test" apparaît dans la bibliothèque
    Et ses sections, pages et illustrations sont jouables hors ligne

  Scénario: Zip sans livre (RG-BIB-002)
    Etant donné un zip ne contenant pas de "sect1.htm"
    Quand le joueur importe ce zip
    Alors le message "Cette archive ne contient pas un livre Project Aon" s'affiche

  Scénario: Suppression d'un livre (RG-BIB-005)
    Etant donné le livre "99test" importé avec une partie en section 12
    Quand le joueur supprime le livre et confirme
    Alors le livre et la partie disparaissent de l'appareil
```

## Données manipulées

| Donnée | Nature | Sensible ? | Conservation / durée |
|---|---|---|---|
| Contenu du livre | Texte et images sous licence Project Aon | non | Jusqu'à suppression par le joueur, sur l'appareil uniquement |

## Écrans et API concernés

Route `/` (`features/library`). Code : `core/book/book-importer.ts`, `core/book/book-repository.ts`. Pas d'API.

## Questions ouvertes

- Faut-il demander à Project Aon une autorisation explicite pour fluidifier l'import (téléchargement intégré) ?

## Historique

| Date | WI | Changement |
|---|---|---|
| 2026-11-16 | n/a | Création |
