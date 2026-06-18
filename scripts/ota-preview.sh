#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-16 — portefeuille universel, carte wallet dashboard (#116)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
