# Fermier Pro

Plateforme mobile-first de gestion d'elevage intelligent, orientee d'abord porcin, avec architecture extensible multi-especes.

## Vision

Fermier Pro est concu comme un ERP agricole moderne combinant:
- operations de ferme
- sante veterinaire
- finance
- nutrition
- marketplace
- collaboration multi-utilisateurs

## Documentation produit

Le blueprint complet est disponible ici:
- `docs/PRODUCT_BLUEPRINT.md`
- `docs/SETUP.md`
- `docs/SUPABASE_AUTH.md` (Google, Apple, telephone + JWT API)
- `docs/RAILWAY.md` (API sur Railway, OTA mobile — ne pas déployer Metro)

Ce document couvre:
- architecture backend
- structure base de donnees
- RBAC + profils
- flux utilisateurs
- navigation mobile
- marketplace + chat temps reel
- roadmap MVP -> V2 -> V3
- strategie SaaS et monetisation

## Structure monorepo

- `apps/mobile` : application React Native (Expo)
- `apps/api` : backend NestJS (REST)
- `packages/types` : types partages
- `packages/ui` : tokens UI partages

## Sécurité PostgREST

L'app mobile ne parle **jamais** à PostgREST pour les tables Prisma : uniquement NestJS + Supabase Auth/Storage. La migration `supabase/migrations/20260713071340_revoke_postgrest_table_access.sql` retire les privileges `anon` / `authenticated` sur le schéma `public` (tables + séquences) et verrouille les default privileges pour les futures tables.

Après application de la migration sur le projet Supabase, vérifier :

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon-key> \
  bash scripts/verify-postgrest-lockdown.sh
```

Le script tente `GET /rest/v1/User?select=id&limit=1` avec la clé anon : exit `0` si HTTP 401/403/404, exit `1` si des lignes (ou un SELECT encore autorisé) sont renvoyées.
