#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-13 — feed + chat admin + notifications PR #93-#95
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
