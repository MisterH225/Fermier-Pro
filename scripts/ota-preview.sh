#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-19 — invitation équipe (deep link, QR, RBAC)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
