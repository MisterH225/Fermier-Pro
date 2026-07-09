#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-09T12:45Z — Webhook GeniusPay abonnement Premium + consultation factures admin + confirm invoiceId mobile
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
