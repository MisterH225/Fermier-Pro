#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-10T22:06Z — suivi commandes boutique escrow + timeline
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
