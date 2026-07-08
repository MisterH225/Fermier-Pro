#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-08T02:45Z — Fix passage Free → Premium commerçant
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
