#!/usr/bin/env bash
# Dernière release OTA production : 2026-07-13T22:45Z — retirer la note technique push des réglages notifications
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" production "$@"
