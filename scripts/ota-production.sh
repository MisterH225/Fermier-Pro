#!/usr/bin/env bash
# Dernière release OTA production : 2026-07-10T14:49Z — GeniusPay webhooks (escrow/abos/topup) + trySilentConfirm producteur
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" production "$@"
