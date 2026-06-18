# Déploiement Railway

## Services attendus

| Composant | Hébergement | Commande |
|-----------|-------------|----------|
| **API NestJS** (`apps/api`) | Railway | `npm run start` (racine du monorepo) |
| **App mobile** (`apps/mobile`) | **EAS Build + OTA** | `bash scripts/ota-production.sh` |
| **Admin** (`apps/admin-platform`) | Vercel ou Railway séparé | `npm run build:admin && npm run start` |

## API sur Railway

1. **Root Directory** : racine du dépôt (pas `apps/mobile`).
2. **Start Command** : `npm run start` (lance `apps/api/scripts/start-prod.cjs`).
3. **Variables** : `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, etc. (voir `.env.example`).
4. **Healthcheck** : `GET /api/v1/health` (configuré dans `railway.json`).

Le fichier `railway.json` à la racine documente build + healthcheck pour éviter les déploiements incorrects.

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
