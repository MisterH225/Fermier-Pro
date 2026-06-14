#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — PR #107 fix Finance + #108 reçus/notifications
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
