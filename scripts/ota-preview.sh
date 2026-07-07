#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-07T20:35Z — Normalisation numéros CI + retry auth/me post-OTP
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
