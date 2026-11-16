# 0001. Faire importer les livres par le joueur

- **Statut** : accepté
- **Date** : 2026-11-16
- **WI** : n/a
- **Décideurs** : porteur du projet

## Contexte

Les livres sont publiés par Project Aon sous une licence qui autorise le téléchargement pour un usage personnel, mais interdit toute redistribution, y compris l'affichage dans un autre site (§2.2). De plus, projectaon.org n'envoie pas d'en-têtes CORS : une application hébergée sur GitHub Pages ne peut pas lire ses fichiers depuis le navigateur.

## Options envisagées

1. **Embarquer les livres dans le build** : expérience la plus fluide, mais viole la licence (dépôt et site publics).
2. **Proxy CORS vers projectaon.org** : demande un serveur ou un service tiers, et reste un affichage dans un autre site.
3. **Import du zip officiel par le joueur, stockage local** : une étape de plus pour le joueur, mais aucune redistribution.
4. **Demander une autorisation à Project Aon** : possible plus tard, sans bloquer le projet.

## Décision

Option 3. Le joueur télécharge le zip depuis projectaon.org, l'application le convertit et le stocke dans IndexedDB.

## Conséquences

- Positives : conforme à la licence ; aucun serveur ; jouable hors ligne.
- Négatives / dette assumée : étape manuelle à l'installation de chaque livre ; la table des résultats de combat, fournie seulement en image dans le zip, est retranscrite dans le code, de même que l'équipement de départ des livres 1 à 5 (`core/game/equipment.ts`) : ce sont des données de mécanique (noms d'objets, nombres), pas le texte des livres.
- À revoir si : Project Aon accorde une autorisation explicite (option 4).
