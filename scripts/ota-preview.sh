#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — PR #104 portefeuille acheteur + onglet Finance
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
