#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — PR #111 (frais vendeur marketplace, commission vet DB, dépense finance vet)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
