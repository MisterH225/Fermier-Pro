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
