#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-20 — localisation ferme + portefeuille Finance
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
