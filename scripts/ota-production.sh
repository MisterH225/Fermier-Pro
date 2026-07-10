#!/usr/bin/env bash
# Dernière release OTA production : 2026-07-10T22:54Z — suivi commandes boutique acheteur + deep link push
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" production "$@"
