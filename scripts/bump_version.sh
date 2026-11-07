#!/bin/bash
# Incrémente la version du site et inscrit la date de mise à jour des données
# dans docs/version.js (affichés dans le pied de chaque page).
#
# Appelé par le robot GitHub Actions (.github/workflows/refresh.yml) et par
# l'alternative Docker (entrypoint.sh), seulement quand les données ont changé.
# Un seul script pour les deux : avant novembre 2026, seul entrypoint.sh le
# faisait, et la date affichée est restée figée au 2026-10-27.
set -euo pipefail

VERSION_FILE="docs/version.js"

CURRENT_VERSION=$(sed -n 's/.*APP_VERSION *= *"\([0-9.]*\)".*/\1/p' "$VERSION_FILE")
if [ -z "$CURRENT_VERSION" ]; then
  echo "ERREUR: APP_VERSION introuvable dans $VERSION_FILE" >&2
  exit 1
fi
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
# Date de Montréal (le robot tourne en UTC)
DATA_DATE=$(TZ=America/Montreal date +"%Y-%m-%d")

cat > "$VERSION_FILE" <<EOV
// Version de l'application (incrémentée automatiquement à chaque mise à jour des données)
var APP_VERSION = "${NEW_VERSION}";
var DATA_UPDATED_AT = "${DATA_DATE}";
EOV

echo "$NEW_VERSION"
