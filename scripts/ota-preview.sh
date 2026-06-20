#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-20 — portefeuille Finance (design Dashboard + écrans dédiés)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
