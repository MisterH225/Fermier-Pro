#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-14 — PR #101 date picker + « Créer une annonce »
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
