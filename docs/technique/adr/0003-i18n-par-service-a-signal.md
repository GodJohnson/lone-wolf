# 0003. Traduire l'interface avec un service à signal

- **Statut** : accepté
- **Date** : 2026-11-16
- **WI** : n/a
- **Décideurs** : porteur du projet

## Contexte

L'interface doit être bilingue FR/EN avec un changement de langue à la volée. Les textes des livres restent dans la langue du zip.

## Options envisagées

1. **`@angular/localize`** : i18n compilée, un build et une URL par langue, pas de changement à chaud.
2. **Bibliothèque tierce (Transloco, ngx-translate)** : dépendance de plus, et fichiers JSON non typés.
3. **Service maison à signal et dictionnaires TypeScript** : environ 50 lignes, clés typées, changement à chaud.

## Décision

Option 3 (`core/i18n`). Le dictionnaire `en` est typé `Record<MessageKey, string>` : une clé manquante est une erreur de compilation.

## Conséquences

- Positives : aucune dépendance, typage des clés, langue mémorisée.
- Négatives / dette assumée : pas de pluralisation ni de formats localisés avancés.
- À revoir si : ajout de nombreuses langues ou besoin de traducteurs externes.
