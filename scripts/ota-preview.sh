#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-16 — orchestrateur wallet, frais admin, retraits validés (#117)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
