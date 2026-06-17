#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-17 — PR #115 (feed → Com, icône @)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
