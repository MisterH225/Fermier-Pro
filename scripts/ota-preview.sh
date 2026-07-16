#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-16T07:15Z — fix crash MerchantProductForm useFocusEffect onboarding
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
