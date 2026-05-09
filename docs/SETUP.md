# Setup Monorepo MVP

## Prerequis

- Node.js **20 LTS** (recommande). Evite Node 25 pour le dev: des plantages memoire (`Zone Allocation failed`) peuvent survenir avec `nest start --watch`.
- npm 10+
- Un projet **[Supabase](https://supabase.com)** (Auth + base **Postgres** hébergée) — chemin nominal décrit ci‑dessous.
- **Docker** : optionnel ; utile seulement si tu veux un Postgres **100 % local** au lieu du cloud Supabase.

## Installation

Depuis la racine du projet:

```bash
npm install
```

### Windows : `EPERM` / `ENOTEMPTY` pendant `npm install`

Le monorepo inclut **React Native** (`react-native`, `react-native-web`). Sous Windows, npm peut échouer en supprimant ou réécrivant `node_modules` si des fichiers sont **verrouillés**.

1. **Arrête** tout ce qui peut toucher au dépôt : Expo / Metro, `npm run dev:api`, onglets « Expo », **Cursor/VS Code** (ou ferme le dossier du projet le temps du nettoyage).
2. Dans le **Gestionnaire des tâches**, termine les processus **Node.js** restants.
3. Supprime le dossier `node_modules` à la racine (Explorateur ou terminal). Si ça bloque, **redémarre** la machine puis supprime à nouveau.
4. Optionnel : ajoute une **exclusion** Windows Defender (ou autre antivirus) sur le dossier du projet pour limiter les verrouillages pendant `npm install`.
5. Relance **`npm install`** à la racine.

Si `rmdir` échoue encore, installe [`rimraf`](https://www.npmjs.com/package/rimraf) globalement (`npm i -g rimraf`) puis `rimraf node_modules` depuis la racine du repo.

## Base de donnees : Supabase (recommande)

L’API Nest et Prisma parlent à Postgres via **`DATABASE_URL`**. Avec Supabase, c’est **la même base** que celle du tableau de bord : tu réutilises la **chaîne de connexion** du projet (voir section détaillée plus bas). Pas besoin d’installer Postgres sur ta machine.

### Option : Postgres local avec Docker

Si tu préfères une base locale (sans cloud) pour expérimenter :

```bash
docker compose up -d
```

Configure alors les variables Docker comme indiqué dans la section sur le `.env` (fallback Prisma quand `SUPABASE_URL` ne pointe pas vers `supabase.co`).

## Lancer API NestJS

Configure au préalable le **`.env`** racine (section **Fichier `.env` avec Supabase** ci‑dessous) : **`DATABASE_URL`** et **`SUPABASE_JWT_SECRET`** pointent vers ton projet Supabase.

```bash
npm run dev:api
```

Si tu vois `No driver (HTTP) has been selected` : c’est en général un **décalage de versions Nest** (ex. `@nestjs/core` en v10 à la racine du monorepo et `@nestjs/platform-express` en v11 sous `apps/api`). Le `package.json` racine déclare `@nestjs/common` / `@nestjs/core` en **11.1.19** pour le hoisting npm ; exécute **`npm install` à la racine** (et supprime d’anciens `node_modules` si besoin) puis relance `npm run dev:api`.

Si tu vois `FATAL ERROR: Zone Allocation failed - process out of memory` pendant le watch:

- le script `start:dev` de l'API reserve deja **8 Go** de heap Node (`--max-old-space-size=8192`)
- ferme les autres apps lourdes (navigateur, emulateurs)
- passe a **Node 20 LTS** si tu es encore sur Node 25

API healthcheck:

```bash
GET http://localhost:3000/api/v1/health
```

## Lancer App Mobile Expo

1. Dans `apps/mobile/`, copier `.env.example` vers `.env`.
2. Renseigner au minimum :
   - `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (dashboard Supabase → Settings → API)
   - `EXPO_PUBLIC_API_URL` : URL atteignable depuis l’appareil (émulateur Android souvent `http://10.0.2.2:3000`, simulateur iOS `http://localhost:3000`, téléphone physique = IP LAN de ta machine + port API)

```bash
npm run dev:mobile
```

Puis ouvrir l’app via Expo Go (Android/iOS) ou web. Une fois connecté avec Supabase (flux à brancher dans l’UI), le bouton **Tester GET /api/v1/auth/me** vérifie le lien avec l’API Nest.

## Fichier `.env` avec Supabase

1. Cree un fichier `.env` a la racine du projet.
2. Dans le dashboard Supabase : **Settings → Database → Connection string** (URI Postgres). C’est ta **`DATABASE_URL`** : la base du projet Supabase **est** un cluster Postgres ; Prisma et l’API s’y connectent comme à n’importe quel Postgres, mais en pratique tu copies/colles depuis Supabase.
3. Renseigne au minimum :

```env
API_PORT=3000
JWT_ACCESS_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
DATABASE_URL=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Important:
- utilise le mot de passe DB exact de Supabase (pas le mot de passe compte utilisateur)
- si le mot de passe contient des caracteres speciaux (`@`, `[`, `]`, `:`, `/`), encode-le en URL
  - exemple `@` devient `%40` (sinon tout ce qui suit le premier `@` est pris pour le **serveur**, pas le mot de passe — connexion impossible ou erreur bizarre type `db....supabase.co:5432`)
- ajoute `sslmode=require` si ce n'est pas deja dans la chaine copiee
- pour **Prisma** (`db push`, `migrate`), prefere une URL **session / directe** (port **5432**). Le pooler transaction (6543) peut poser probleme ; reserve-le eventuellement a la prod uniquement via une autre config

4. Ajoute aussi **Supabase Auth** pour l'API :

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_SECRET=<JWT Secret depuis Settings -> API>
```

Voir `docs/SUPABASE_AUTH.md` pour Google, Apple et telephone.

5. Le fichier `.env` est a la **racine** du monorepo (puis optionnellement `apps/api/.env`). Les scripts Prisma chargent ces fichiers via `apps/api/scripts/prisma-run.cjs`. Si `DATABASE_URL` est vide mais que tu as les variables **Docker** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` **et** que tu n’utilises pas Supabase (`SUPABASE_URL` sans `supabase.co`), l’URL locale est composee pour Prisma. Avec Supabase, une `DATABASE_URL` cloud est **obligatoire** (le fallback Docker vers `127.0.0.1` est desactive pour eviter de pousser le schema au mauvais serveur).

6. Apres changement du schema Prisma (ex. `User.supabaseUserId`), synchronise la base :

```bash
npm run prisma:push --workspace @fermier/api
```

Si la commande **reste bloquee longtemps** alors que la connexion affiche le pooler **:6543**, arrete avec Ctrl+C et definis **`PRISMA_DATABASE_URL`** dans le `.env` racine : meme mot de passe que `DATABASE_URL`, mais URL **session / directe en port 5432** (voir Supabase → Settings → Database). Les scripts Prisma utilisent alors cette URL pour `migrate` / `db push` uniquement ; l’API continue d’utiliser `DATABASE_URL`.

7. Lance ensuite l'API normalement:

```bash
npm run dev:api
```

8. Verifie:

```bash
http://localhost:3000/api/v1/health
```

## Tests end-to-end (contrat API / mobile)

Le fichier `apps/api/test/mobile-api-contract.e2e-spec.ts` exécute **Supertest** contre l’app Nest réelle et une **base Postgres** (en dev : typiquement **celle de ton projet Supabase**, via la même `DATABASE_URL` que l’API). Les JWT de test sont signés avec **`SUPABASE_JWT_SECRET`**, comme les vrais jetons Supabase. La suite injecte des données seed (ferme, lot, animal, profil producteur). Elle couvre les routes utilisées par `apps/mobile/src/lib/api.ts` : **auth/me**, **fermes** (liste, détail, **POST création** avec `X-Profile-Id`), **animaux** (liste, détail, pesée, santé), **lots** (liste, détail, pesée, santé), **tâches**.

**Convention :** chaque nouveau wrapper dans `apps/mobile/src/lib/api.ts` doit être accompagné d’au moins un cas dans cette suite (ou dans un nouveau fichier `*.e2e-spec.ts` si le fichier devient trop volumineux).

**Prérequis :** les **mêmes variables** que pour faire tourner l’API contre Supabase :

- **`DATABASE_URL`** — chaîne **Session mode** / directe (port **5432**) copiée depuis Supabase (**Settings → Database**), schéma à jour (`npm run prisma:push --workspace @fermier/api`). Tu peux aussi utiliser un Postgres local (`docker compose`) si tu ne veux pas toucher au projet cloud pour les tests.
- **`SUPABASE_JWT_SECRET`** — **Settings → API → JWT Secret** (identique à celui utilisé par l’API pour valider les `access_token`).

**Attention :** les tests **écrivent** en base (seed + nettoyage). Utilise de préférence un **projet Supabase de dev / staging**, ou une base jetable locale, pas la prod.

Depuis la racine du repo :

```bash
cd apps/api && npm run prisma:push && cd ../..
npm run test:e2e
```

Si `DATABASE_URL` ou `SUPABASE_JWT_SECRET` sont absents, la suite est **ignorée** et un message l’indique dans la console.

**CI :** le workflow `.github/workflows/e2e-api.yml` lance la même suite sur un **Postgres éphémère** (service GitHub Actions) — pas besoin de ton Supabase ; ça vérifie la stack Nest + Prisma sans exposer ton projet cloud.

**Limite :** ce ne sont pas des tests UI (Expo). Pour du bout-en-bout navigateur, une piste est **Expo Web** + Playwright ou **Maestro** sur build native ; à traiter quand un flux de connexion testable en CI sera stabilisé.

## Prochaines taches MVP recommandees

1. ~~Profil actif + switcher, TanStack Query, liste fermes.~~
2. ~~Cheptel (liste animaux + lots), creation ferme.~~
3. ~~**Detail animal / lot** : historique pesees + formulaire POST poids (scopes `livestockWrite`).~~
4. ~~Journal technicien + santé lot sur mobile (`tasksRead`/`tasksWrite`, `healthRead`/`healthWrite`).~~
5. Auth refresh / polish OTP ; offline partiel (hors scope immediat).
