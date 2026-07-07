#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-07 — Switch profil commerçant + suppression compte
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
