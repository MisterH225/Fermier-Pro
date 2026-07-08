#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-08T23:20Z — Codes promo abonnement commerçant + test renouvellement admin
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
