#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-19 — session et API post-orchestrateur
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
