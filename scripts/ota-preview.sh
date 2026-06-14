#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — UI score producteur PR #98
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
