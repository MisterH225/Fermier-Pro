# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

Fermier Pro is an npm workspaces monorepo with two apps and two shared packages. See `README.md` and `docs/SETUP.md` for full details.

| Package | Path | Purpose |
|---------|------|---------|
| `@fermier/api` | `apps/api` | NestJS 11 REST + WebSocket backend (port 3000) |
| `@fermier/mobile` | `apps/mobile` | React Native / Expo 54 mobile app |
| `@fermier/types` | `packages/types` | Shared TypeScript types |
| `@fermier/ui` | `packages/ui` | Shared UI tokens |

### Node version

Use **Node 20 LTS**. Node 25 causes memory crashes with `nest start --watch`. The VM has nvm pre-configured with Node 20 as default.

### Database (local Docker Postgres)

The cloud VM uses a local Docker Postgres (via `docker-compose.yml`) instead of Supabase cloud. Docker and the Postgres container are started before the agent session begins via the update script.

- `.env` at the repo root provides `DATABASE_URL=postgresql://fermier:fermier_dev@127.0.0.1:5432/fermier_pro` and a local `SUPABASE_JWT_SECRET`.
- After install, push the Prisma schema: `npm run prisma:push --workspace @fermier/api`

### Running services

| Action | Command | Notes |
|--------|---------|-------|
| Start API (dev) | `npm run dev:api` | Starts NestJS with watch mode on port 3000. Healthcheck: `GET /api/v1/health` |
| Start Mobile (Metro) | `npm run dev:mobile` | Metro bundler for Expo Go / simulators. Web mode fails due to `react-native-maps` native dep. |
| Lint API | `npm run lint:api` | ESLint with `--max-warnings=0` |
| Build API | `npm run build:api` | `nest build` |
| Typecheck mobile | `npm run typecheck:mobile` | `tsc --noEmit` |
| Full CI quality | `npm run ci:quality` | Prisma generate + lint + build + typecheck |
| E2E tests | `npm run test:e2e` | Jest e2e against local Postgres (requires running DB + schema pushed) |

### Gotchas

- **DashboardModule / FarmHealthModule**: these modules were missing the `AuthModule` import (required for `SupabaseJwtGuard`). A fix was applied adding `AuthModule` to their imports. Without this fix the API crashes on startup.
- **Expo web mode**: `npx expo start --web` fails because `react-native-maps` doesn't support web. Use Metro without `--web` for the mobile app.
- **E2e test type mismatches**: 2 of 40 e2e tests fail due to Prisma returning `Decimal` as string while tests expect number. This is a pre-existing issue, not caused by environment setup.
- **JWT for local testing**: sign tokens with `jsonwebtoken` using the `SUPABASE_JWT_SECRET` from `.env`. The payload must include `{ sub: "<supabase-user-id>", role: "authenticated", aud: "authenticated" }`.
- **Farm creation requires `X-Profile-Id`**: create a producer profile via `POST /api/v1/profiles` first, then pass its id as `X-Profile-Id` header when creating farms.
