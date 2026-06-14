#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — fix marketplace offres/crédit PR #99 #100
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
