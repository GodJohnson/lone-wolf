# 0004. Confier la traduction française des livres au navigateur

- **Statut** : accepté
- **Date** : 2026-11-16
- **WI** : n/a
- **Décideurs** : porteur du projet

## Contexte

Project Aon ne publie les livres qu'en anglais et en espagnol. Les joueurs veulent les lire en français. La licence range les traductions parmi les œuvres dérivées (§1.4), soumises à l'interdiction de redistribution (§2.2). La traduction française officielle appartient à son éditeur.

## Options envisagées

1. **Traduction versionnée dans le dépôt** : interdite par la licence.
2. **Traduction intégrée au navigateur** (Chrome, Safari) : disponible sur mobile aujourd'hui, initiée par le joueur pour son usage personnel, sans code de traduction dans l'application. La qualité est variable et les termes de jeu ne sont pas maîtrisés. Le texte peut transiter par le service du navigateur.
3. **API Translator de Chrome** (modèle local) : bonne qualité, glossaire possible, rien ne quitte l'appareil. Disponible uniquement sur Chrome ordinateur à ce jour.
4. **Service cloud** (DeepL, Google, LLM) : la meilleure qualité, mais l'application enverrait le texte à un tiers non validé par le Groupement SIC, avec une clé d'API impossible à protéger dans un site statique.

## Décision

Option 2. L'application facilite la traduction par le navigateur :
- pendant la lecture, la langue du document est celle du livre (`I18nService.contentLang`) ;
- l'interface est marquée `translate="no"` et seul le texte du livre est marqué `translate="yes"` ;
- une astuce explique comment lancer la traduction, et peut être masquée.

Le texte du livre est rendu par `[innerHTML]` et remplacé à chaque changement de section, ce qui tolère la réécriture du DOM par le traducteur (vérifié par simulation).

## Conséquences

- Positives : aucun coût, rien à maintenir, conforme à la licence (usage personnel initié par le joueur), fonctionne sur mobile.
- Négatives / dette assumée : qualité non maîtrisée (ex. « COMBAT SKILL » ne devient pas « HABILETÉ ») ; le texte peut être envoyé au service de traduction du navigateur.
- À revoir si : l'API Translator de Chrome devient disponible sur Android (option 3, avec glossaire).
