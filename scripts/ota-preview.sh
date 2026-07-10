#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-10T22:51Z — suivi commandes boutique acheteur + deep link push
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
