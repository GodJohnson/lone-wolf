#!/usr/bin/env bash
# sic-doc controler-doc.sh — version 1
# Contrôle la documentation d'un dépôt applicatif SIC (skill documentation-projet).
#
# Usage : controler-doc.sh [--base <ref>] [--ci] [--racine <dossier>] [--version]
#   --base <ref>   référence de comparaison (défaut : base de .sic-doc.conf, sinon origin/develop)
#   --ci           émet aussi les annotations Azure Pipelines (##vso[task.logissue])
#   --racine <d>   dépôt à contrôler (défaut : dépôt courant)
#
# Contrôles (cf. skill) :
#   R1  code modifié => doc modifiée (matrice changement -> doc), sauf trailer « Docs: n/a — <raison> »
#   R2  fiches docs/fonctionnel/** : front-matter valide (wi, statut, donnees_sensibles)
#   R3  numérotation des ADR sans doublon ni trou
#   R4  liens relatifs Markdown non cassés
#   R5  aucun secret / chaîne de connexion / chemin UNC dans la doc (faits d'infra -> SIC_INFRA_MAP)
#   R6  marqueur [À RENSEIGNER] interdit dans une fiche au statut « valide »
# Variable d'environnement : SIC_DOC_NA=1 équivaut à un trailer « Docs: n/a » (usage hook).
# Sortie : code 0 = conforme (avertissements possibles), 1 = au moins une erreur, 2 = usage.
set -uo pipefail

VERSION=1
BASE=""
CI=0
RACINE="."
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:-}"; shift 2 ;;
    --ci) CI=1; shift ;;
    --racine) RACINE="${2:-.}"; shift 2 ;;
    --version) echo "sic-doc controler-doc.sh v$VERSION"; exit 0 ;;
    *) echo "Argument inconnu : $1" >&2; exit 2 ;;
  esac
done

cd "$RACINE" || { echo "Dossier introuvable : $RACINE" >&2; exit 2; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Pas un dépôt Git : $RACINE" >&2; exit 2; }
cd "$ROOT"

if [ -z "$BASE" ] && [ -f .sic-doc.conf ]; then
  # shellcheck disable=SC1091
  BASE="$(sed -n 's/^BASE_REF=//p' .sic-doc.conf | head -n 1 | tr -d '\r"')"
fi
BASE="${BASE:-origin/develop}"

ERRORS=0
WARNINGS=0
err()  { ERRORS=$((ERRORS+1));     echo "[ERREUR] $*"; [ "$CI" = 1 ] && echo "##vso[task.logissue type=error]$*"; return 0; }
warn() { WARNINGS=$((WARNINGS+1)); echo "[AVERT.] $*"; [ "$CI" = 1 ] && echo "##vso[task.logissue type=warning]$*"; return 0; }

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  if git rev-parse --verify --quiet "${BASE#origin/}" >/dev/null; then
    BASE="${BASE#origin/}"
  else
    echo "Référence de base introuvable : $BASE (fetch complet requis en CI : fetchDepth: 0)" >&2
    exit 2
  fi
fi

CHANGED="$(git diff --name-only --diff-filter=ACMRD "$BASE"...HEAD 2>/dev/null | tr -d '\r')"

# ---------------------------------------------------------------- R1
EXCL='(^|/)(bin|obj|node_modules)/|\.spec\.ts$|\.test\.ts$|\.d\.ts$|(^|/)[^/]*[Tt]ests?(/|\.)|Designer\.cs$|ModelSnapshot\.cs$'
CODE="$(echo "$CHANGED" | grep -E '\.(cs|ts|sql)$' | grep -Ev "$EXCL" | grep -Ev '^docs/' || true)"
API="$(echo "$CODE"  | grep -E '(Controller[^/]*\.cs$|/(Controllers|Endpoints)/)' || true)"
SQL="$(echo "$CHANGED" | grep -E '\.sql$|/Migrations/[^/]*\.cs$' | grep -Ev 'Designer\.cs$|ModelSnapshot\.cs$' || true)"
DEPLOY="$(echo "$CHANGED" | grep -E '(^|/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|azure-pipelines[^/]*\.ya?ml|appsettings[^/]*\.json)$' || true)"
DEPS="$(echo "$CHANGED" | grep -E '\.csproj$|(^|/)package\.json$' || true)"

has_changed() { echo "$CHANGED" | grep -Eq "$1"; }

NA=0
if [ "${SIC_DOC_NA:-0}" = 1 ]; then NA=1; NA_RAISON="(déclaré par l'appelant)"; fi
NA_LINES="$(git log "$BASE"..HEAD --format=%B 2>/dev/null | tr -d '\r' | grep -E '^Docs: n/a[[:space:]]*[—–-]+[[:space:]]*.{5,}' || true)"
if [ -n "$NA_LINES" ]; then NA=1; NA_RAISON="$NA_LINES"; fi

NEED=0
if [ -n "$CODE$SQL$DEPLOY" ]; then
  NEED=1
  if [ "$NA" = 1 ]; then
    warn "Docs: n/a utilisé — à auditer : ${NA_RAISON//$'\n'/ | }"
  else
    has_changed '^(docs/|README\.md$)' || err "R1 : code modifié sans aucune mise à jour de docs/ ni du README (ou trailer « Docs: n/a — <raison> » dans un commit)."
    [ -n "$API" ] && ! has_changed '^docs/(technique/api/|fonctionnel/)' \
      && err "R1 : endpoint/contrat modifié (${API%%$'\n'*}…) sans mise à jour de docs/technique/api/ ni de la fiche fonctionnelle."
    [ -n "$SQL" ] && ! has_changed '^docs/technique/donnees\.md$' \
      && err "R1 : SQL/migration modifié (${SQL%%$'\n'*}…) sans mise à jour de docs/technique/donnees.md."
    [ -n "$DEPLOY" ] && ! has_changed '^docs/technique/exploitation\.md$' \
      && err "R1 : déploiement/configuration modifié (${DEPLOY%%$'\n'*}…) sans mise à jour de docs/technique/exploitation.md."
  fi
fi
[ -n "$DEPS" ] && warn "Dépendances modifiées (${DEPS%%$'\n'*}…) : un ADR est requis si le choix est structurant (docs/technique/adr/)."

# ---------------------------------------------------------------- listes de fichiers docs
MD_FILES="$( { find docs -type f -name '*.md' 2>/dev/null; [ -f README.md ] && echo README.md; } | sort )"

# ---------------------------------------------------------------- R2 / R6 : fiches fonctionnelles
frontmatter() { awk 'NR==1{ if ($0!="---") exit 1; next } $0=="---"{exit 0} {print}' "$1" | tr -d '\r'; }
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in docs/fonctionnel/*) ;; *) continue ;; esac
  base="$(basename "$f")"
  case "$base" in _*|glossaire.md|README.md) continue ;; esac
  fm="$(frontmatter "$f")" || fm=""
  if [ -z "$fm" ]; then err "R2 : $f — front-matter YAML absent (wi, statut, donnees_sensibles)."; continue; fi
  wi="$(echo "$fm" | sed -n 's/^wi:[[:space:]]*//p' | sed 's/[[:space:]][[:space:]]*#.*//; s/[[:space:]]*$//' | head -n1)"
  st="$(echo "$fm" | sed -n 's/^statut:[[:space:]]*//p' | sed 's/[[:space:]][[:space:]]*#.*//; s/[[:space:]]*$//' | head -n1)"
  ds="$(echo "$fm" | sed -n 's/^donnees_sensibles:[[:space:]]*//p' | sed 's/[[:space:]][[:space:]]*#.*//; s/[[:space:]]*$//' | head -n1)"
  echo "$wi" | grep -Eq '^(AB#[0-9]+|n/a)$' || err "R2 : $f — « wi » doit valoir AB#<id> ou n/a (trouvé : « $wi »)."
  echo "$wi" | grep -Eq '^AB#0+$' && warn "R2 : $f — wi = AB#0000 (valeur du modèle à remplacer)."
  echo "$st" | grep -Eq '^(brouillon|a-valider|valide)$' || err "R2 : $f — « statut » doit valoir brouillon|a-valider|valide (trouvé : « $st »)."
  echo "$ds" | grep -Eq '^(oui|non|a-qualifier)$' || err "R2 : $f — « donnees_sensibles » doit valoir oui|non|a-qualifier (trouvé : « $ds »)."
  if [ "$st" = "valide" ] && grep -q '\[À RENSEIGNER\]' "$f"; then err "R6 : $f — statut « valide » mais marqueur [À RENSEIGNER] encore présent."; fi
  if [ "$st" = "valide" ] && grep -qiE 'à valider|a valider' "$f"; then warn "R6 : $f — statut « valide » mais des règles de gestion « à valider » subsistent."; fi
done <<< "$MD_FILES"

# Placeholders restants dans la doc technique : avertissement
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in docs/fonctionnel/*) continue ;; esac
  grep -q '\[À RENSEIGNER\]' "$f" && warn "$f — contient encore [À RENSEIGNER]."
done <<< "$MD_FILES"

# ---------------------------------------------------------------- R3 : ADR
if [ -d docs/technique/adr ]; then
  NUMS="$(ls docs/technique/adr 2>/dev/null | grep -E '^[0-9]{4}-.+\.md$' | grep -v '^0000-' | cut -c1-4 | sort || true)"
  if [ -n "$NUMS" ]; then
    DUP="$(echo "$NUMS" | uniq -d)"
    [ -n "$DUP" ] && err "R3 : numéro(s) d'ADR en double : $(echo "$DUP" | tr '\n' ' ')."
    i=1
    for n in $(echo "$NUMS" | uniq); do
      exp="$(printf '%04d' "$i")"
      if [ "$n" != "$exp" ]; then err "R3 : numérotation des ADR discontinue (attendu $exp, trouvé $n)."; break; fi
      i=$((i+1))
    done
  fi
  while IFS= read -r x; do
    [ -n "$x" ] && warn "R3 : docs/technique/adr/$x ne respecte pas le nommage NNNN-titre.md."
  done < <(ls docs/technique/adr 2>/dev/null | grep -Ev '^([0-9]{4}-.+\.md|README\.md|\.gitkeep)$' || true)
fi

# ---------------------------------------------------------------- R4 : liens relatifs
while IFS= read -r f; do
  [ -z "$f" ] && continue
  dir="$(dirname "$f")"
  while IFS= read -r link; do
    case "$link" in ''|http*|mailto:*|\#*|'<'*) continue ;; esac
    target="${link%%#*}"; target="${target%% *}"
    [ -z "$target" ] && continue
    [ -e "$dir/$target" ] || [ -e "$target" ] || err "R4 : $f — lien relatif cassé : $link"
  done < <(grep -o '\]([^)]*)' "$f" 2>/dev/null | sed 's/^](//; s/)$//')
done <<< "$MD_FILES"

# ---------------------------------------------------------------- R5 : secrets / infra dans la doc
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if grep -iEn '(password|pwd|user id|uid|data source|server)[[:space:]]*=[[:space:]]*[^[:space:]<{$"`]' "$f" >/dev/null 2>&1; then
    err "R5 : $f — chaîne de connexion / identifiant apparent en clair (utiliser <placeholder>, variable d'environnement ou coffre)."
  fi
  if grep -En '[\][\][A-Za-z0-9_.-]+[\]' "$f" >/dev/null 2>&1; then
    err "R5 : $f — chemin UNC (partage interne) : faits d'infra à renvoyer vers SIC_INFRA_MAP, pas dans le dépôt."
  fi
  if grep -En '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' "$f" 2>/dev/null | grep -Ev '127\.0\.0\.1|0\.0\.0\.0' >/dev/null; then
    warn "R5 : $f — adresse IP apparente (infra interne ? si oui, renvoyer vers SIC_INFRA_MAP)."
  fi
done <<< "$MD_FILES"

# ---------------------------------------------------------------- bilan
echo "---"
echo "sic-doc v$VERSION — base $BASE — $ERRORS erreur(s), $WARNINGS avertissement(s)."
[ "$NEED" = 0 ] && echo "(aucun changement de code/SQL/déploiement : R1 non applicable)"
[ "$ERRORS" -gt 0 ] && exit 1
exit 0
