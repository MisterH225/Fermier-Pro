#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — PR #110 (annulation vente, frais plateforme acheteur, 34 lint)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
