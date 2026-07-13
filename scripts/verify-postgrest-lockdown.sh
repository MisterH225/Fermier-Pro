#!/usr/bin/env bash
# Vérifie que PostgREST ne renvoie plus de lignes des tables Prisma avec la clé anon.
# Usage :
#   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... \
#     bash scripts/verify-postgrest-lockdown.sh
#
# Exit 0 : 401 / 403 / 404 (accès refusé ou ressource absente côté Data API).
# Exit 1 : 200 avec des lignes (fuite), variables manquantes, ou autre échec.

set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "error: SUPABASE_URL et SUPABASE_ANON_KEY sont requis" >&2
  exit 1
fi

BASE_URL="${SUPABASE_URL%/}"
URL="${BASE_URL}/rest/v1/User?select=id&limit=1"

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT

http_code="$(
  curl -sS -o "$tmp_body" -w '%{http_code}' \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Accept: application/json" \
    "$URL"
)"

body="$(cat "$tmp_body")"

case "$http_code" in
  401|403|404)
    echo "ok: PostgREST refuse l'accès à public.User (HTTP ${http_code})"
    exit 0
    ;;
  200)
    # Tableau JSON non vide → données exposées via la clé anon.
    if printf '%s' "$body" | grep -qE '^\s*\[\s*\{'; then
      echo "fail: PostgREST a renvoyé des lignes User avec la clé anon (HTTP 200)" >&2
      echo "$body" >&2
      exit 1
    fi
    # 200 avec [] : la table reste joignable (SELECT autorisé) — considérer comme échec.
    if printf '%s' "$body" | grep -qE '^\s*\[\s*\]\s*$'; then
      echo "fail: PostgREST accepte encore SELECT sur User (HTTP 200, tableau vide)" >&2
      exit 1
    fi
    echo "fail: réponse HTTP 200 inattendue depuis /rest/v1/User" >&2
    echo "$body" >&2
    exit 1
    ;;
  *)
    echo "fail: code HTTP inattendu ${http_code} depuis /rest/v1/User" >&2
    echo "$body" >&2
    exit 1
    ;;
esac
