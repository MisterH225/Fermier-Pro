# Console SuperAdmin — Fermier Pro

Plateforme web d'administration connectée à l'API NestJS et Supabase Auth.

## Prérequis

- Node.js 20+
- API locale : `npm run dev:api` (port 3000)
- Migration appliquée : `20260526120000_superadmin_platform`
- Compte utilisateur présent dans la table `SuperAdmin`

## Configuration

1. Copier `apps/admin-platform/.env.local.example` → `apps/admin-platform/.env.local`
2. Renseigner les mêmes `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` que l'app mobile
3. `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`

## Premier SuperAdmin

Après migration, promouvoir un utilisateur existant :

```sql
INSERT INTO "SuperAdmin" ("id", "userId", "createdAt")
VALUES (gen_random_uuid()::text, '<USER_ID_PRISMA>', NOW());
```

(`USER_ID` = champ `id` de la table `User`, pas `supabaseUserId`)

## Lancement

```bash
npm install
npm run dev:admin
```

→ http://localhost:3001/fr/login

## Routes API admin (JWT SuperAdmin)

| Méthode | Chemin |
|---------|--------|
| GET | `/api/v1/admin/me` |
| GET | `/api/v1/admin/platform/overview` |
| GET | `/api/v1/admin/vet-profiles?status=pending` |
| POST | `/api/v1/admin/vet-profiles/:id/verify` |
| POST | `/api/v1/admin/vet-profiles/:id/reject` |
| GET | `/api/v1/admin/users` |
| GET | `/api/v1/admin/health-map` |
| GET | `/api/v1/admin/stats` |

Les anciennes routes secret `x-vet-verification-secret` restent disponibles pour scripts.
