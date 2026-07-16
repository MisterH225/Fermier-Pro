#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-16T02:25Z — fix abonnement commerçant (factures + UX GeniusPay)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
