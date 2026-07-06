#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-06 — Arbitrage poids marketplace (par animal, seuils admin)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
