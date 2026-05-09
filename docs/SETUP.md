# Setup Monorepo MVP

## Prerequis

- Node.js **20 LTS** (recommande). Evite Node 25 pour le dev: des plantages memoire (`Zone Allocation failed`) peuvent survenir avec `nest start --watch`.
- npm 10+
- Docker (pour PostgreSQL local)

## Installation

Depuis la racine du projet:

```bash
npm install
```

## Lancer PostgreSQL

```bash
docker compose up -d
```

Si tu n'utilises pas Docker/PostgreSQL local, passe directement a la section Supabase plus bas.

## Lancer API NestJS

```bash
npm run dev:api
```

Si tu vois `FATAL ERROR: Zone Allocation failed - process out of memory` pendant le watch:

- le script `start:dev` de l'API reserve deja **8 Go** de heap Node (`--max-old-space-size=8192`)
- ferme les autres apps lourdes (navigateur, emulateurs)
- passe a **Node 20 LTS** si tu es encore sur Node 25

API healthcheck:

```bash
GET http://localhost:3000/api/v1/health
```

## Lancer App Mobile Expo

```bash
npm run dev:mobile
```

Puis ouvrir l'app via Expo Go (Android/iOS) ou web.

## Setup sans Docker: Supabase (recommande)

1. Cree un fichier `.env` a la racine du projet.
2. Copie les valeurs depuis ton projet Supabase:
   - `Settings -> Database -> Connection string`
3. Renseigne au minimum:

```env
API_PORT=3000
JWT_ACCESS_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
DATABASE_URL=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Important:
- utilise le mot de passe DB exact de Supabase (pas le mot de passe compte utilisateur)
- si le mot de passe contient des caracteres speciaux (`@`, `[`, `]`, `:`, `/`), encode-le en URL
  - exemple `@` devient `%40` (sinon tout ce qui suit le premier `@` est pris pour le **serveur**, pas le mot de passe — connexion impossible ou erreur bizarre type `db....supabase.co:5432`)
- ajoute `sslmode=require` sur les deux URLs si ce n'est pas deja dans la chaine copiee

4. Ajoute aussi **Supabase Auth** pour l'API :

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_SECRET=<JWT Secret depuis Settings -> API>
```

Voir `docs/SUPABASE_AUTH.md` pour Google, Apple et telephone.

5. Le fichier `.env` est a la **racine** du monorepo. Les commandes Prisma (`prisma:push`, etc.) chargent automatiquement `../../.env` depuis `apps/api`.

6. Apres changement du schema Prisma (ex. `User.supabaseUserId`), synchronise la base :

```bash
npm run prisma:push --workspace @fermier/api
```

7. Lance ensuite l'API normalement:

```bash
npm run dev:api
```

8. Verifie:

```bash
http://localhost:3000/api/v1/health
```

## Prochaines taches MVP recommandees

1. Auth JWT + refresh + profile switcher
2. Entites ferme + memberships
3. Entites animaux + poids + historique
4. Journal quotidien technicien
5. Permissions RBAC/ABAC par profil actif
