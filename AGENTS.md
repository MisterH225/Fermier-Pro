# Fermier Pro - Agent Instructions

## Cursor Cloud specific instructions

### Architecture overview

Fermier Pro is a monorepo (npm workspaces) with 3 apps and 2 shared packages:

| Path | Service | Port | Command |
|------|---------|------|---------|
| `apps/api` | NestJS REST + WebSocket backend | 3000 | `npm run dev:api` |
| `apps/admin-platform` | Next.js 14 SuperAdmin console | 3001 | `npm run dev:admin` |
| `apps/mobile` | React Native / Expo mobile app | — | `npm run dev:mobile` |
| `packages/types` | Shared TypeScript types | — | — |
| `packages/ui` | Shared UI tokens | — | — |

### Prerequisites

- **Node.js 22 LTS** (or 20 LTS). Avoid Node 25 (memory crashes with `nest start --watch`).
- **Docker** is required to run a local PostgreSQL 16 via `docker-compose.yml`.
- **npm** is the package manager (lockfile: `package-lock.json`).

### Starting services

1. **PostgreSQL**: `sudo dockerd` (if not running), then `sudo docker compose up -d` from repo root.
2. **Environment**: A `.env` file is needed at the repo root. Copy `.env.example` and fill in `DATABASE_URL` and `DIRECT_URL` pointing to the local Postgres (`postgresql://fermier:fermier_dev@127.0.0.1:5432/fermier_pro`). Set `SUPABASE_JWT_SECRET` (any string for local dev/tests; use `ci-e2e-jwt-secret-for-automated-tests-only` to match CI).
3. **Prisma push**: `npm run prisma:push --workspace @fermier/api` to sync schema after first setup or schema changes.
4. **API**: `npm run dev:api` (runs `nest start --watch` with 8 GB heap).
5. **Admin**: `npm run dev:admin` (Next.js on port 3001).
6. **Mobile**: `npm run dev:mobile` — must be run from root, not from `apps/mobile`.

### Key commands (see `package.json` scripts)

- **Lint**: `npm run lint:api` (ESLint, `--max-warnings=0`; the codebase has 16 pre-existing lint errors).
- **Build**: `npm run build:api`
- **Typecheck mobile**: `npm run typecheck:mobile`
- **Typecheck admin**: `npm run typecheck:admin`
- **Full CI quality**: `npm run ci:quality` (prisma generate + lint + build + mobile typecheck)
- **E2E tests**: `npm run test:e2e` (requires Postgres running; uses `DATABASE_URL` and `SUPABASE_JWT_SECRET`)

### Gotchas

- The `start-dev.cjs` script tries `netstat`/`taskkill` (Windows-only) to free the API port before starting — this harmlessly fails on Linux.
- `prisma-run.cjs` uses `dotenv` to load `.env` files; if `SUPABASE_URL` contains `supabase.co` but `DATABASE_URL` is empty, it refuses to compose a local Docker URL (safety check). For local dev without Supabase, either omit `SUPABASE_URL` or set it to a non-`supabase.co` value.
- The admin platform responds with 307 on `/` (Next.js redirect to locale route) — this is normal.
- Docker in the Cloud Agent VM requires `sudo` for `dockerd` and `docker compose` commands. The daemon uses `fuse-overlayfs` storage driver and `iptables-legacy`.
- Expo/mobile app testing requires a real Supabase project for auth (Google/Apple/OTP) — not available in headless cloud agent environments.
