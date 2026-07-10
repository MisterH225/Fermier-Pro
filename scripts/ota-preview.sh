#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-10T14:47Z — GeniusPay webhooks (escrow/abos/topup) + trySilentConfirm producteur
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
