#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-10T17:13Z — checkout GeniusPay abo + settle wallet Premium
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
