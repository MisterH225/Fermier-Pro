#!/usr/bin/env bash
# Dernière release OTA production : 2026-07-11T11:59Z — cloche in-app commandes boutique + carte suivi dashboard
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" production "$@"
