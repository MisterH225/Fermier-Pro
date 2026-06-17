#!/usr/bin/env bash
# Dernière release OTA preview : 2026-06-17 — PR #112 (security hardening) + PR #113 (feed bulles, avatars, présence)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
