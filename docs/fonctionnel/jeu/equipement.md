---
wi: n/a
statut: a-valider
donnees_sensibles: non
---

# Gérer son équipement

## Contexte et objectif

L'équipement change le déroulement d'une partie : sans arme, le héros perd 4 points d'HABILETÉ, et une cotte de mailles ajoute de l'ENDURANCE. L'application doit donc donner l'équipement de départ prévu par le livre, appliquer les effets des objets et faire respecter les capacités de transport, au lieu de laisser le joueur tout recopier à la main.

## Acteurs et habilitations

| Acteur | Peut faire | Condition / rôle requis |
|---|---|---|
| Joueur | Recevoir l'équipement de départ, ajouter, retirer et utiliser des objets, régler les Repas | Partie en cours (ou création) |

## Règles de gestion

| ID | Énoncé | Source | Confirmation |
|---|---|---|---|
| RG-EQU-001 | Livre 1 : Axe, 1 Repas, Map of Sommerlund, or = tirage, plus un objet tiré au sort (0 Broadsword, 1 Sword, 2 Helmet, 3 Two Meals, 4 Chainmail Waistcoat, 5 Mace, 6 Healing Potion, 7 Quarterstaff, 8 Spear, 9 12 Gold Crowns) | Livre 1, *Equipment* | à valider |
| RG-EQU-002 | Livres 2 à 5 : objets fixes du livre, or = 10 + tirage, puis N objets au choix dans une liste (2, 2, 6 et 4 objets) | Livres 2 à 5, *Equipment* | à valider |
| RG-EQU-003 | Pour les autres livres, l'équipement de départ est saisi à la main d'après la page « Equipment » | Données non relevées | à valider |
| RG-EQU-004 | Au plus 2 armes ; au plus 8 éléments dans le sac à dos, Repas compris ; au plus 50 couronnes d'or | Livre 1, *How Much Can You Carry?* | à valider |
| RG-EQU-005 | Helmet +2, Padded Leather Waistcoat +2, Chainmail Waistcoat +4 à l'ENDURANCE totale et courante tant qu'ils sont portés ; le bonus est retiré si l'objet est abandonné | Livres 1 à 3, *Equipment* | à valider |
| RG-EQU-006 | Shield : +2 en HABILETÉ pendant les combats | Livres 2, 4 et 5, *Equipment* | à valider |
| RG-EQU-007 | Healing Potion / Potion of Laumspur : +4 END sans dépasser le total, une dose, impossible pendant un combat | Livres 1 à 5, *Equipment* | à valider |
| RG-EQU-008 | Quand le texte impose de manger (« must … eat a Meal »), le joueur consomme un Repas, utilise Chasse s'il possède la discipline, ou perd 3 END | Livre 1, *Food* | à valider |
| RG-EQU-009 | Le joueur décide si la Chasse est possible : certaines régions l'interdisent et seul le texte le précise | Livres 3 à 5, *Food* | à valider |

## Scénarios (Gherkin)

```gherkin
Fonctionnalité: Équipement

  Scénario: Équipement de départ du livre 1 (RG-EQU-001)
    Etant donné une nouvelle partie du livre 1
    Quand le joueur tire 7 pour l'or et 4 pour l'objet
    Alors il possède Axe, 1 Repas, Map of Sommerlund, Chainmail Waistcoat et 7 couronnes
    Et son ENDURANCE totale est augmentée de 4

  Scénario: Troisième arme refusée (RG-EQU-004)
    Etant donné un héros portant Axe et Sword
    Quand il ajoute Mace
    Alors l'ajout est refusé avec le message « abandonnez-en une d'abord »

  Scénario: Repas imposé sans nourriture (RG-EQU-008)
    Etant donné un héros sans Repas ni Chasse, ENDURANCE 20
    Quand la section impose de manger et qu'il choisit « Ne rien manger »
    Alors son ENDURANCE vaut 17
```

## Données manipulées

| Donnée | Nature | Sensible ? | Conservation / durée |
|---|---|---|---|
| Inventaire | État de jeu | non | Sur l'appareil, jusqu'à abandon |

## Écrans et API concernés

Routes `/book/:bookId/new` (équipement de départ), `/book/:bookId/chart` (inventaire), `/book/:bookId/play` (Repas, bouclier en combat). Code : `core/game/equipment.ts`.

## Questions ouvertes

- Relever l'équipement de départ des livres 6 et suivants.
- Report de l'inventaire d'un livre au suivant (les livres 2 à 5 le prévoient).

## Historique

| Date | WI | Changement |
|---|---|---|
| 2026-11-16 | n/a | Création |
