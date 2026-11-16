# 0002. Héberger une application statique sur GitHub Pages

- **Statut** : accepté
- **Date** : 2026-11-16
- **WI** : n/a
- **Décideurs** : porteur du projet

## Contexte

Le besoin est un hébergement gratuit, directement depuis GitHub, d'une application utilisée sur mobile. Aucune donnée n'a besoin d'être partagée entre appareils.

## Options envisagées

1. **SPA statique sur GitHub Pages, routage par hash, PWA** : gratuit et sans backend. GitHub Pages ne réécrit pas les URL profondes.
2. **SPA avec SSR ou backend** : inutile sans données serveur, et non supporté par GitHub Pages.

## Décision

Option 1 : `withHashLocation()` pour que les URL profondes fonctionnent, service worker Angular pour le hors-ligne, déploiement par GitHub Actions.

## Conséquences

- Positives : coût nul, déploiement automatique, fonctionne hors ligne.
- Négatives / dette assumée : URL avec `#` ; pas de synchronisation des parties entre appareils.
- À revoir si : une synchronisation multi-appareils devient nécessaire.
