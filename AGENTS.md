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

### Cloud Agent install script

Do **not** run bare `npm install` as the install script: the monorepo no longer uses a root `postinstall` hook (Prisma auto-install during `npm install` fails in cloud snapshots).

Use instead:

```bash
bash scripts/cloud-install.sh
```

Or manually:

```bash
npm install --ignore-scripts
PRISMA_GENERATE_SKIP_AUTOINSTALL=true npm run prisma:generate
```

After install, generate the Prisma client locally with `npm run prisma:generate` if you skipped the cloud script.

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

### Marketplace escrow / settlement — agent protocol (mandatory)

Any change that touches escrow settlement, fund release/refund, credit settle, or receipt timing after close **must** follow this protocol. Goal: stop fixes that introduce new money bugs.

#### Invariants (validate with the human before coding)

1. **No receipt without complete settlement** — do not emit/generate a marketplace receipt until close + listing `sold` + `RELEASE_TO_SELLER` (+ `REFUND_BUYER` when `buyerRefundAmount > 0`) are true.
2. **Settlement is idempotent** — at most one `RELEASE_TO_SELLER` and one owed `REFUND_BUYER` per transaction; retries must finish missing side-effects, never double-pay.
3. **`TRANSACTION_CLOSED` ≠ done** — a closed tx with listing not sold, missing release, or missing owed refund is **incomplete** and must be recoverable.
4. **Credit has an explicit trigger** — `settleCreditTransaction` must run on a defined event (receipt when balance is 0 / already paid, or seller balance confirmation). Never leave credit stuck on `BUYER_RECEIVED` with only a notification.
5. **Real mutual exclusion** — use `DistributedLockService` (Redis) for settle paths. Do **not** reintroduce session `pg_advisory_lock` via Prisma (broken behind transaction poolers).

#### Workflow before a PR

1. **Diagnose first** (Ask / read-only): status at failure, fund movements, which code path emitted the receipt — no code until the human OK.
2. **List invariants + files/functions** to change — human OK; keep the diff minimal (prefer 1 critical bug per PR).
3. **Implement** — no silent early `return` on financial guards without `log.warn` (or stronger).
4. **Mandatory tests** — if the PR changes `settleTransaction` / `settleCreditTransaction` / prior-release recovery / receipt gating:
   - extend or add cases in `apps/api/test/escrow-settle-failure-modes.e2e-spec.ts` (partial RELEASE recovery, double settle, weight↓ refund, credit balance 0, CLOSED incomplete);
   - do not merge on happy-path e2e alone.
5. **Done means** CI `e2e-api` green for those cases — not only lint/unit.

#### Admin diagnostics

- Incomplete settlements are exposed for SuperAdmin via `GET /api/v1/admin/marketplace/transactions/incomplete-settlements` and the marketplace admin tab **Règlements incomplets**.
- Prefer diagnosing with that list before guessing; use retry settle only when recovery is intentional.
