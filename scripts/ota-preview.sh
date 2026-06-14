#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — fix API Railway PR #97 (ProducerScoreModule)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
