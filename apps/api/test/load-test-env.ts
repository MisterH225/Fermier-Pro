import { config } from "dotenv";
import { join } from "path";

/**
 * Charge les `.env` comme `main.ts` : typiquement **DATABASE_URL** (Postgres Supabase
 * ou local) et **SUPABASE_JWT_SECRET** (dashboard Supabase → API).
 */
config({ path: join(__dirname, "../.env") });
/** Racine du monorepo (depuis `apps/api/test/`). */
config({ path: join(__dirname, "../../../.env") });
