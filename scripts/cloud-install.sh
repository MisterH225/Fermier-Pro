#!/usr/bin/env bash
# Installation recommandée pour Cursor Cloud Agent (monorepo npm workspaces).
# Évite le postinstall Prisma pendant npm install (auto-install imbriqué → exit 254).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

printf '>>> [cloud-install] start\n'

npm install --ignore-scripts

export PRISMA_GENERATE_SKIP_AUTOINSTALL=true
npm run prisma:generate

if [[ -f .env ]] && command -v docker >/dev/null 2>&1; then
  if docker compose ps postgres 2>/dev/null | grep -qE 'Up|running'; then
    npm run prisma:migrate:deploy --workspace @fermier/api
  fi
fi

printf '<<< [cloud-install] complete\n'
