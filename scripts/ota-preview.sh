#!/usr/bin/env bash
# Dernière release OTA preview : 2026-07-07 — Profil commerçant (boutique marketplace) + portefeuille
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/ota.sh" preview "$@"
