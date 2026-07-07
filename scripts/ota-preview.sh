#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-07T21:00Z — Normalisation E.164 Afrique de l'Ouest (16 pays)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
