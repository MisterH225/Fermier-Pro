#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-16T01:46Z — file d'attente terrain idempotence + badge sync + fix réglages notifications
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
