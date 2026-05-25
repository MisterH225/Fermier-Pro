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
4. `NEXT_PUBLIC_ADMIN_URL=http://localhost:3001` (URL publique de la console)

### Connexion Google (éviter l’erreur `exp://`)

Le projet mobile utilise des URLs `exp://…` dans Supabase. **La console web a besoin de sa propre Redirect URL.**

Dans [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL Configuration** → **Redirect URLs**, ajoutez **en plus** des URLs mobile :

```
http://localhost:3001/auth/callback
```

(L’écran de login affiche l’URL exacte à copier.)

Ne supprimez pas les `exp://…` déjà présents (app mobile). Gardez les deux.

## Premier SuperAdmin

Après migration, promouvoir un utilisateur existant :

```bash
# Par email (recommandé)
npm run promote:superadmin --workspace @fermier/api -- --email votre@email.com

# Par id Prisma User
npm run promote:superadmin --workspace @fermier/api -- --user-id clxxxxxxxx

# Lister les comptes SuperAdmin
npm run promote:superadmin --workspace @fermier/api -- --list
```

Équivalent SQL manuel :

```sql
INSERT INTO "SuperAdmin" ("id", "userId", "createdAt")
VALUES (gen_random_uuid()::text, '<USER_ID_PRISMA>', NOW());
```

(`USER_ID` = champ `id` de la table `User`, pas `supabaseUserId`)

## Tests e2e API admin

Avec `DATABASE_URL` et `SUPABASE_JWT_SECRET` configurés :

```bash
npm run test:e2e --workspace @fermier/api
```

Le fichier `test/admin-platform.e2e-spec.ts` couvre `/admin/me`, overview, users, settings, carte, stats et alertes sanitaires.

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

Les scripts ops utilisent `POST /api/v1/internal/vet-profiles/:id/verify|reject` avec l'en-tête `x-vet-verification-secret`.
