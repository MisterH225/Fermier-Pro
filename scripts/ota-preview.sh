#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-16T02:00Z — fix crash boucle abonnement commerçant Premium
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
