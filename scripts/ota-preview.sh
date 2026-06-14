#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-22 — PR #103 poids vif/carcasse marketplace
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
