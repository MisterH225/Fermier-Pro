#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-13 — flux marketplace acheteur-led PR #90
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
