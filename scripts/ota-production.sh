#!/usr/bin/env bash
# Dernière release OTA production : 2026-07-10T17:15Z — checkout GeniusPay abo + settle wallet Premium
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" production "$@"
