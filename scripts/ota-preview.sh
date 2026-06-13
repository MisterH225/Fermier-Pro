#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-13 — fix portées All PR #87
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
