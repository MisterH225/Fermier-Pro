#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-07 — Inscription par téléphone (Yellika SMS) + commerçant
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
