#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "Erreur : EXPO_TOKEN manquant."
  echo "Crée un token sur https://expo.dev/accounts/misterh225/settings/access-tokens"
  echo "puis exporte-le : export EXPO_TOKEN=..."
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MESSAGE="${1:-OTA preview $(date -u +%Y-%m-%dT%H:%MZ)}"
npx eas-cli update --channel preview --non-interactive --message "$MESSAGE"
