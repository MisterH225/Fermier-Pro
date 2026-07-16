#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-16T23:35Z — onglet Indices marketplace + Indice de prix porc
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
