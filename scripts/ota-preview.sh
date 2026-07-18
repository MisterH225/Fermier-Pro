#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-18T07:55Z — correction boucle redirection notifications push (détails commande / litige)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
