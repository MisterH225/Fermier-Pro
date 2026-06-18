#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-18 — refonte UI carte wallet dashboard (#118)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
