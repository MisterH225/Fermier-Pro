#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-17 — fix invalidation cache stock aliment (stats/chart)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
