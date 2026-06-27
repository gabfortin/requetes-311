#!/bin/bash
set -euo pipefail

# Required env vars:
#   GITHUB_TOKEN  — personal access token with repo write access
#   GITHUB_REPO   — e.g. "gabfortin/requetes-311"
# Optional:
#   GIT_USER_NAME  (default: "311 Bot")
#   GIT_USER_EMAIL (default: "bot@users.noreply.github.com")

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPO:?GITHUB_REPO is required}"

GIT_USER_NAME="${GIT_USER_NAME:-311 Bot}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-bot@users.noreply.github.com}"

WORKSPACE="/workspace"

echo "==> Clonage du dépôt ${GITHUB_REPO}..."
git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "$WORKSPACE"
cd "$WORKSPACE"

git config user.name  "$GIT_USER_NAME"
git config user.email "$GIT_USER_EMAIL"

USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

echo "==> Découverte de l'URL du CSV via l'API CKAN..."
CKAN_JSON=$(curl -fsSL -A "$USER_AGENT" "https://donnees.montreal.ca/api/3/action/package_show?id=requete-311")

# Choisit la ressource dont le nom contient "2022" (CSV actif)
CSV_URL=$(echo "$CKAN_JSON" \
  | jq -r '.result.resources[] | select(.name | test("2022"; "i")) | .url' \
  | head -1)

if [ -z "$CSV_URL" ]; then
  echo "ERREUR: impossible de trouver l'URL du CSV dans la réponse CKAN" >&2
  exit 1
fi

echo "==> Téléchargement du CSV depuis ${CSV_URL}..."
curl -fL --retry 3 --retry-delay 5 --progress-bar \
  -A "$USER_AGENT" \
  -H "Accept: text/csv,application/csv,*/*" \
  -H "Accept-Language: fr-CA,fr;q=0.9,en;q=0.8" \
  -H "Referer: https://donnees.montreal.ca/dataset/requete-311" \
  -o requetes311.csv "$CSV_URL"

echo "==> Génération des fichiers de données..."
python3 generate.py

echo "==> Staging des fichiers générés..."
git add docs/data.js docs/rows.json docs/proprete_data.js

if git diff --staged --quiet; then
  echo "==> Aucun changement détecté — rien à pousser."
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "==> Commit et push (${TIMESTAMP})..."
git commit -m "chore: mise à jour automatique des données 311 – ${TIMESTAMP}"
git push origin main

echo "==> Terminé."
