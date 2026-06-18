# Déploiement Railway

## Services attendus

| Composant | Hébergement | Config Railway | Commande |
|-----------|-------------|----------------|----------|
| **API NestJS** (`apps/api`) | Railway | `railway.json` (racine) | `node apps/api/scripts/start-api.cjs` |
| **App mobile** (`apps/mobile`) | **EAS Build + OTA** | — | `bash scripts/ota-production.sh` |
| **Admin** (`apps/admin-platform`) | Railway séparé ou Vercel | `railway.admin.json` | `npm run build:admin` puis `next start` |

## API sur Railway

1. **Root Directory** : racine du dépôt (pas `apps/mobile`).
2. **Config as code** : `railway.json` à la racine (watch paths limités à `apps/api/**`).
3. **Start Command** : `node apps/api/scripts/start-api.cjs` (défini dans `railway.json`).
4. **Pre-deploy** : `npm run prisma:migrate:deploy --workspace @fermier/api` — les migrations ne bloquent plus le healthcheck.
5. **Port** : Railway injecte `PORT` ; l'API écoute `PORT` puis `API_PORT` (défaut 3000). Ne pas forcer un port fixe sans `PORT`.
6. **Variables** : `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, etc. (voir `.env.example`).
7. **Healthcheck** : `GET /api/v1/health` (configuré dans `railway.json`).

### Healthcheck failure (~5 min)

Si le déploiement échoue à l'étape **Network > Healthcheck** alors que le build réussit :

- **Cause fréquente** : `prisma migrate deploy` dans le `startCommand` bloque le démarrage HTTP jusqu'au timeout.
- **Correctif** (déjà dans `railway.json`) : migrations en `preDeployCommand`, API seule au démarrage.
- **Autre cause** : l'API n'écoutait pas sur `process.env.PORT` (Railway route le trafic vers ce port).

## Admin sur Railway

Service **distinct** de l'API (`fermierapi-production`).

1. Créer un second service dans le même projet Railway.
2. **Root Directory** : racine du monorepo.
3. **Settings → Config file path** : `railway.admin.json`
4. **Watch patterns** (déjà dans le fichier) : `apps/admin-platform/**` — un merge admin déclenche ce service, pas l'API.
5. Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ADMIN_URL`, etc.
6. **Healthcheck** : `/fr/login` (page publique).

La PR #124 (middleware auth, `sharp`) ne concerne **que** ce service admin, pas `fermierapi-production`.

**Node.js** : le monorepo exige **Node 20** (`.nvmrc`, `nixpacks.toml`, `engines` dans `package.json`). Si le build Nixpacks utilise Node 18 (`EBADENGINE`), vérifier que ces fichiers sont bien déployés.

**Build Prisma** : la commande utilise `npm run prisma:generate --workspace @fermier/api` (Prisma 5 local via `prisma-run.cjs`). Ne pas utiliser `npm exec prisma generate` qui peut télécharger Prisma 6 via npx et échouer avec `query_engine_bg.postgresql.wasm-base64.js` introuvable.

**Install build** : `npm install --ignore-scripts --include=dev` — Railway installe en mode production par défaut (`omit=dev`). Sans `--include=dev`, `prisma` et `@nestjs/cli` sont absents (`Cannot find module 'prisma/package.json'`). Le CLI `prisma` est aussi en `dependencies` de `@fermier/api` pour `migrate deploy` au démarrage.

## Erreur : `expo start` + SIGTERM (~5 s)

Si les logs Railway montrent :

```
> @fermier/mobile@0.1.0 start
> expo start
Metro is running in CI mode...
Stopping Container
npm error signal SIGTERM
```

**Cause** : un service Railway pointe vers `apps/mobile` au lieu de l'API. Metro écoute `localhost:8081` ; le healthcheck Railway échoue et tue le conteneur.

**Correctif** :

1. Ouvrir le service concerné dans Railway → **Settings** → **Root Directory**.
2. Remettre la racine du monorepo (vide ou `/`), **pas** `apps/mobile`.
3. **Start Command** : `npm run start`.
4. Ou supprimer ce service s'il était dédié par erreur à l'app mobile.

L'app mobile refuse désormais de démarrer sur Railway (`apps/mobile/scripts/assert-not-railway.cjs`) avec un message explicite.

## OTA (mises à jour JS sans rebuild store)

```bash
bash scripts/ota-preview.sh "message"
bash scripts/ota-production.sh "message"
```

Nécessite `EXPO_TOKEN` (expo.dev → Access Tokens).

## Erreur API : P3009 — migration Prisma en échec

Si les logs API montrent :

```
Error: P3009
migrate found failed migrations in the target database
The `20260624120000_universal_user_wallet` migration ... failed
[start-prod] Échec de prisma migrate deploy — arrêt.
```

**Cause** : la migration a été appliquée sur Supabase (schéma déjà à jour) mais `_prisma_migrations` contient une entrée **failed** (souvent parce que le SQL Prisma attendait `BuyerWallet*` alors que Supabase avait déjà renommé en `UserWallet*`).

**Correctif** (schéma déjà présent — vérifier `UserWallet`, `WalletFeeConfig`, etc.) :

```bash
cd apps/api
npm run prisma:migrate:resolve -- --applied 20260624120000_universal_user_wallet
npm run prisma:migrate:resolve -- --applied 20260625120000_payment_orchestrator
npm run prisma:migrate:deploy
```

Ou via SQL Supabase (si `prisma migrate resolve` n'est pas disponible) : marquer `finished_at` sur la migration failed et insérer les migrations manquantes dans `_prisma_migrations`.

**Prévention** : appliquer les changements de schéma wallet **une seule fois** — soit via Supabase MCP / migrations SQL, soit via `prisma migrate deploy` au démarrage Railway, pas les deux en parallèle sur la même base.
