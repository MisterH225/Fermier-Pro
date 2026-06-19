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
4. **Pre-deploy** : `node apps/api/scripts/railway-predeploy.cjs` (défini dans `railway.json`).
5. **Port** : Railway injecte `PORT` ; l'API écoute `PORT` puis `API_PORT` (défaut 3000). Ne pas forcer un port fixe sans `PORT`.
6. **Variables** : `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, etc. (voir `.env.example`).
7. **Healthcheck** : `GET /api/v1/health` (configuré dans `railway.json`).
8. **Serverless** : `sleepApplication: false` dans `railway.json` — **désactiver aussi dans Settings** si le toggle UI est encore ON.

### Serverless ON → app mobile « Application failed to respond »

Si **Enable Serverless** est activé sur le service API :

- sans trafic, Railway **arrête** le conteneur ;
- la première requête (`/health`, `/auth/me`) reçoit **502** en ~150 ms (`Application failed to respond`) ;
- l'app mobile reste bloquée sur l'écran de chargement ou « Réessayer ».

**Correctif** : Settings → Serverless → **OFF**. Le fichier `railway.json` impose `sleepApplication: false` et `numReplicas: 1`.

### Supprimer le service `fermiermobile`

Ne pas héberger `apps/mobile` sur Railway (`npm run start --workspace=@fermier/mobile` → `expo start`).  
Supprimer le service **fermiermobile** (ou désactiver son auto-deploy). L'app mobile = **EAS + OTA preview** uniquement.

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

## Railway ne déploie pas le dernier `main` (ex. PR #129)

GitHub a bien le code (`git log origin/main` → commit `2d50ed9` pour la PR #129). Si Railway affiche encore une PR plus ancienne (#127, #123…) :

### « Redeploy » ≠ dernier commit

| Action Railway | Comportement |
|----------------|--------------|
| **Redeploy** sur un déploiement existant | Reconstruit **le même commit SHA** que ce déploiement |
| **Deploy** depuis la branche `main` | Prend le **dernier commit** de `main` |

**À faire** : Service API → **Deployments** → bouton **Deploy** (ou **Deploy latest**) → branche **`main`**.  
Ne pas utiliser « Redeploy » sur un ancien déploiement si vous voulez la PR #129.

### Réglages à vérifier (Settings → Source)

1. **Repository** : `MisterH225/Fermier-Pro` (pas un fork)
2. **Branch** : `main` (pas `cursor/...` ni une branche figée)
3. **Root Directory** : vide ou `/` (racine du monorepo)
4. **Config file path** : `railway.json` (ou vide si Railway lit la racine)
5. **Wait for CI** : si activé et CI rouge, le déploiement peut ne jamais partir

### Vérifier le commit réellement buildé

Dans les **logs de build**, chercher la ligne injectée par `railway.json` :

```
[railway-build] GIT_COMMIT=2d50ed98fce58934f7a3191b11539de0d74873bb
```

Si le SHA ne commence pas par `2d50ed9` (PR #129) ou plus récent, Railway n'a pas buildé le bon `main`.

### Forcer un nouveau déploiement depuis GitHub

1. Settings → Source → **Disconnect** puis reconnecter le repo (branche `main`)
2. Ou pousser un commit sur `main` (ex. merge d'une PR qui touche `railway.json`) pour déclencher le webhook

### Commit de référence `main` (PR #129)

```
2d50ed9 Merge pull request #129 — mobile-money.module.ts, suppression buyer-wallet
```

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

Le script `apps/api/scripts/railway-predeploy.cjs` (pre-deploy Railway) tente automatiquement `migrate resolve --applied` sur les migrations wallet/orchestrateur en cas de P3009.

## API injoignable — mobile « Application failed to respond »

Si `curl https://fermierapi-production.up.railway.app/api/v1/health` renvoie **502**, l'app mobile ne peut pas appeler `GET /auth/me` au démarrage.

### Port public 3000 alors que l'API écoute sur 8080 (cause fréquente)

Symptômes :

- Logs runtime : `[bootstrap] API en écoute sur 0.0.0.0:8080`
- `curl /api/v1/health` → **502** en ~150 ms, header `x-railway-fallback: true`
- **Networking** → domaine public affiche **→ Port 3000**

**Pourquoi ça marchait avant avec le port 3000**

Avant la PR #125, l'API utilisait uniquement `API_PORT` (défaut **3000** en local, voir `.env.example`) et **ignorait** la variable `PORT` injectée par Railway. Le domaine public en **3000** et l'application étaient donc alignés.

Depuis la PR #125, l'API écoute `process.env.PORT` **en priorité** (recommandation Railway pour le healthcheck). Sans `PORT` explicite dans les variables du service, Railway injecte souvent **8080** → décalage avec un domaine toujours ciblé sur **3000**.

**Ce n'est pas lié à `APP_ENV=staging`** : cette variable sert au gateway mobile money simulé (`MOBILE_MONEY_PROVIDER=dev`, pas d'agrégateur réel). Elle n'a aucun effet sur le port d'écoute.

**Deux correctifs équivalents** (service **@fermier/api**) :

| Option | Action | Résultat |
|--------|--------|----------|
| **A — garder le port 3000** (config historique) | Variables → ajouter **`PORT=3000`** ; laisser le domaine public sur **3000** | Logs : `en écoute sur 0.0.0.0:3000` |
| **B — suivre le PORT Railway** | Networking → modifier le domaine → target port **8080** (valeur des logs bootstrap) | Pas de variable `PORT` à définir |

Les deux options fonctionnent tant que **target port du domaine = port d'écoute de l'API**.

Vérification :

```bash
curl -sS https://fermierapi-production.up.railway.app/api/v1/health
# Attendu : {"service":"fermier-api","status":"ok",...}
```

| Cause | Logs Railway | Correctif |
|-------|--------------|-----------|
| **Target port ≠ PORT** (ex. domaine → 3000, app → 8080) | Boot OK, 502 immédiat, `x-railway-fallback: true` | Option A : `PORT=3000` **ou** option B : domaine → **8080** |
| `APP_ENV=production` + `MOBILE_MONEY_PROVIDER=dev` | `MOBILE_MONEY_PROVIDER=dev interdit en production` | `bootstrap-prod-env` force `APP_ENV=staging` si provider=dev ; ou brancher un vrai provider |
| P3009 migrations wallet/orchestrateur | `failed migrations` / `universal_user_wallet` | `railway-predeploy.cjs` ou `prisma migrate resolve --applied` (voir ci-dessus) |
| Healthcheck timeout | API démarre après migrate dans startCommand | Utiliser `start-api.cjs` + migrations en preDeploy |
