#!/usr/bin/env bash
# Dernière release OTA production : 2026-07-10T22:10Z — suivi commandes boutique escrow + timeline
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" production "$@"
