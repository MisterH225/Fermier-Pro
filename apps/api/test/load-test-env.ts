import { config } from "dotenv";
import { join } from "path";

/**
 * Charge les `.env` comme `main.ts` : typiquement **DATABASE_URL** (Postgres Supabase
 * ou local) et **SUPABASE_JWT_SECRET** (dashboard Supabase → API).
 *
 * Priorité : `apps/api/.e2e-env.local` (si présent) puis `apps/api/.env` puis racine.
 */
config({ path: join(__dirname, "../.e2e-env.local") });
config({ path: join(__dirname, "../.env") });
/** Racine du monorepo (depuis `apps/api/test/`). */
config({ path: join(__dirname, "../../../.env") });

if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
const looksLikeProduction =
  /rwtrebeujkacbwwpuwpz|fermierpro-production|supabase\.co/i.test(dbUrl) &&
  !/127\.0\.0\.1|localhost|fermier_dev/i.test(dbUrl);

if (looksLikeProduction && process.env.ALLOW_E2E_ON_PRODUCTION !== "1") {
  throw new Error(
    "[e2e] Refus d'exécuter les tests contre une base de production. " +
      "Utilisez Postgres local (docker-compose) via apps/api/.e2e-env.local, " +
      "ou exportez ALLOW_E2E_ON_PRODUCTION=1 uniquement en connaissance de cause."
  );
}
