#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-07T19:17Z — Erreurs SMS lisibles + auth téléphone
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
