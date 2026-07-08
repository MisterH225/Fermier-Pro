#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-08T15:47Z — Marketplace annonces unifiées (porcs + produits commerçants)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
