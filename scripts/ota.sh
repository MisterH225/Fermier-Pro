#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"

CHANNEL="${1:-}"
if [[ -z "$CHANNEL" ]]; then
  echo "Usage: $0 <preview|production> [message]"
  exit 1
fi

if [[ "$CHANNEL" != "preview" && "$CHANNEL" != "production" ]]; then
  echo "Erreur : canal invalide « $CHANNEL » (preview ou production)."
  exit 1
fi

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "Erreur : EXPO_TOKEN manquant."
  echo "Crée un token sur https://expo.dev/accounts/misterh225/settings/access-tokens"
  echo "puis exporte-le : export EXPO_TOKEN=..."
  exit 1
fi

# Variables publiques alignées sur eas.json (profils preview / production).
export APP_ENV="$CHANNEL"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://fermierapi-production.up.railway.app}"
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://rwtrebeujkacbwwpuwpz.supabase.co}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3dHJlYmV1amthY2J3d3B1d3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjA1MTcsImV4cCI6MjA5MzMzNjUxN30.mGW50cpaKrqTyS1-N5Vb7S_iaHWZ5kslRaHikWlCp54}"
export EXPO_PUBLIC_EAS_PROJECT_ID="${EXPO_PUBLIC_EAS_PROJECT_ID:-ebb8a3e5-e17a-4a66-ae0a-f7624ab6c12a}"
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:-742075194736-0hcd73lku61a5t2vma7ggf6evtk8bqkl.apps.googleusercontent.com}"
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-742075194736-76b019pl2eu7k39ocp4lfnjlcqqhi227.apps.googleusercontent.com}"
export EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:-742075194736-ukme83465m4g39r3s8ghoib7cusu1v1r.apps.googleusercontent.com}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MESSAGE="${2:-OTA $CHANNEL $(date -u +%Y-%m-%dT%H:%MZ)}"
echo "Publication OTA sur le canal « $CHANNEL »…"
npx eas update --channel "$CHANNEL" --non-interactive --message "$MESSAGE"
