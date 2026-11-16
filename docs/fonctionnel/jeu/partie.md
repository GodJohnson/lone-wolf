---
wi: n/a
statut: a-valider
donnees_sensibles: non
---

# Jouer une partie

## Contexte et objectif

Remplacer le livre papier, le crayon et la Feuille d'aventure par une interface mobile : lecture section par section, choix en un geste, tirages et combats calculés, sauvegarde permanente.

## Acteurs et habilitations

| Acteur | Peut faire | Condition / rôle requis |
|---|---|---|
| Joueur | Créer un personnage, lire, choisir, combattre, modifier sa Feuille d'aventure, revenir en arrière | Livre importé |

## Règles de gestion

Règles du jeu vérifiées sur le livre 1 (série Kaï). Les autres séries utilisent des valeurs par défaut signalées comme non vérifiées dans l'interface.

| ID | Énoncé | Source | Confirmation |
|---|---|---|---|
| RG-JEU-001 | Série Kaï : HABILETÉ = 10 + tirage, ENDURANCE = 20 + tirage ; 5 disciplines | Livre 1, *Game Rules* | à valider |
| RG-JEU-002 | Le tirage de la Table de hasard est un entier uniforme de 0 à 9 | Livre 1, *Random Number Table* | à valider |
| RG-JEU-003 | Weaponskill : l'arme est tirée (0 Dagger, 1 Spear, 2 Mace, 3 Short Sword, 4 Warhammer, 5 et 7 Sword, 6 Axe, 8 Quarterstaff, 9 Broadsword) ; +2 HAB si elle est portée | Livre 1, *Kai Disciplines* | à valider |
| RG-JEU-004 | Combat sans arme : −4 HAB ; Mindblast : +2 HAB si utilisé (désactivable pour un ennemi insensible) ; modificateur de section saisi par le joueur | Livre 1, *Rules for Combat* | à valider |
| RG-JEU-005 | Chaque assaut applique la table des résultats selon le quotient d'attaque ; `K` = END à 0 ; le combat se termine quand une END atteint 0 | Livre 1, *Combat Results Table* | à valider |
| RG-JEU-006 | Fuite : seules les pertes du héros sont appliquées pour l'assaut, puis le combat se termine | Livre 1, *Rules for Combat* | à valider |
| RG-JEU-007 | Healing : +1 END en quittant une section où le héros n'a pas combattu, sans dépasser l'END initiale | Livre 1, *Kai Disciplines* | à valider |
| RG-JEU-008 | Au plus 2 armes, 8 objets dans le sac à dos (Kaï), 50 couronnes d'or | Livre 1, *Equipment* | à valider |
| RG-JEU-009 | La partie est enregistrée à chaque action ; une seule partie par livre | Choix de conception | à valider |
| RG-JEU-010 | Le retour à la section précédente n'annule pas les modifications de la Feuille d'aventure | Choix de conception | à valider |

## Scénarios (Gherkin)

```gherkin
Fonctionnalité: Partie

  Scénario: Création d'un personnage Kaï (RG-JEU-001)
    Etant donné un livre de la série Kaï importé
    Quand le joueur tire 3 pour l'HABILETÉ et 7 pour l'ENDURANCE
    Alors son HABILETÉ vaut 13 et son ENDURANCE vaut 27

  Scénario: Assaut gagnant (RG-JEU-005)
    Etant donné un héros d'HABILETÉ 15 portant une arme, face à un ennemi d'HABILETÉ 15 et d'ENDURANCE 3
    Quand le tirage vaut 1
    Alors l'ennemi perd 3 points et meurt
    Et le héros perd 5 points

  Scénario: Guérison (RG-JEU-007)
    Etant donné un héros avec Healing, ENDURANCE 20 sur 25, dans une section sans combat
    Quand il choisit une autre section
    Alors son ENDURANCE vaut 21
```

## Données manipulées

| Donnée | Nature | Sensible ? | Conservation / durée |
|---|---|---|---|
| Partie | État de jeu et notes libres du joueur | non | Sur l'appareil, jusqu'à abandon |

## Écrans et API concernés

Routes `/book/:bookId/new`, `/book/:bookId/play`, `/book/:bookId/chart`, `/book/:bookId/page/:pageId`. Code : `core/game/*`. Pas d'API.

## Questions ouvertes

- Règles de création et effets automatiques des séries Magnakaï, Grand Maître et Nouvel Ordre à vérifier.
- Transfert du personnage d'un livre au suivant.

## Historique

| Date | WI | Changement |
|---|---|---|
| 2026-11-16 | n/a | Création |
