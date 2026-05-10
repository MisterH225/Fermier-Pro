/**
 * Charge les `.env`, résout `DATABASE_URL` (fichier + variables), puis lance Prisma.
 *
 * Ne compose pas une URL locale depuis POSTGRES_* si le projet cible Supabase
 * (évite de pousser le schéma vers 127.0.0.1 alors que DATABASE_URL cloud est dans le fichier).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const apiRoot = path.join(__dirname, "..");
const repoRoot = path.join(__dirname, "..", "..", "..");

function deleteEmptyEnvKeys(keys) {
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(process.env, key) &&
      String(process.env[key] ?? "").trim() === ""
    ) {
      delete process.env[key];
    }
  }
}

deleteEmptyEnvKeys(["DATABASE_URL", "DIRECT_URL", "PRISMA_DATABASE_URL"]);

const rootEnv = path.join(repoRoot, ".env");
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: false });
}
const apiEnv = path.join(apiRoot, ".env");
if (fs.existsSync(apiEnv)) {
  dotenv.config({ path: apiEnv, override: false });
}

deleteEmptyEnvKeys(["DATABASE_URL", "DIRECT_URL", "PRISMA_DATABASE_URL"]);

const env = { ...process.env };

function stripOuterQuotes(s) {
  const t = String(s || "").trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).trim();
  }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Lit une cle dans un fichier .env (une ligne KEY=value), sans dependre uniquement de dotenv
 * (BOM, variables systeme vides, etc.).
 */
function parseEnvKeyFromFile(filePath, key) {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  let raw = fs.readFileSync(filePath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) {
      continue;
    }
    return stripOuterQuotes(trimmed.slice(eq + 1).trim());
  }
  return "";
}

function isSupabaseContext(e) {
  const u = String(e.SUPABASE_URL || "").trim();
  return u.includes("supabase.co");
}

function resolveDatabaseUrl(e) {
  let direct = stripOuterQuotes(e.DATABASE_URL);
  if (direct) {
    return direct;
  }

  direct = parseEnvKeyFromFile(rootEnv, "DATABASE_URL");
  if (direct) {
    return direct;
  }
  direct = parseEnvKeyFromFile(apiEnv, "DATABASE_URL");
  if (direct) {
    return direct;
  }

  if (isSupabaseContext(e)) {
    console.error(
      [
        "prisma-run: DATABASE_URL est vide ou illisible, alors que SUPABASE_URL pointe vers Supabase.",
        "Verifie dans le .env a la racine du monorepo :",
        "- une ligne DATABASE_URL=postgresql://... (sans espaces avant le nom de variable),",
        "- pas de variable systeme Windows DATABASE_URL vide qui masque le fichier,",
        "- encodage UTF-8 du fichier.",
        "Ne sera pas utilise le fallback Docker POSTGRES_* vers 127.0.0.1 dans ce contexte."
      ].join("\n")
    );
    process.exit(1);
  }

  const pgDb = String(e.POSTGRES_DB || "").trim();
  if (pgDb) {
    const user = String(e.POSTGRES_USER || "postgres").trim();
    const password = String(e.POSTGRES_PASSWORD ?? "");
    const port = String(e.POSTGRES_PORT || "5432").trim();
    const host = String(e.POSTGRES_HOST || "127.0.0.1").trim();
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(password);
    const encDb = encodeURIComponent(pgDb);
    return `postgresql://${encUser}:${encPass}@${host}:${port}/${encDb}`;
  }

  const dbHost = String(e.DB_HOST || "").trim();
  if (dbHost) {
    const user = String(e.DB_USER || "postgres").trim();
    const password = String(e.DB_PASSWORD ?? "");
    const name = String(e.DB_NAME || "postgres").trim();
    const port = String(e.DB_PORT || "5432").trim();
    const ssl =
      String(e.DB_SSL || "").toLowerCase() === "true" ? "?sslmode=require" : "";
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${dbHost}:${port}/${encodeURIComponent(name)}${ssl}`;
  }

  return "";
}

/**
 * URL dediee aux commandes Prisma (migrate, db push). Si definie, remplace DATABASE_URL
 * pour ce sous-processus uniquement — utile avec Supabase : pooler 6543 peut bloquer ;
 * une URL session / directe en 5432 est recommandee (voir PRISMA_DATABASE_URL dans .env.example).
 */
function resolvePrismaDatabaseUrl(e) {
  let url = stripOuterQuotes(e.PRISMA_DATABASE_URL);
  if (url) {
    return { url, source: "PRISMA_DATABASE_URL" };
  }
  url = parseEnvKeyFromFile(rootEnv, "PRISMA_DATABASE_URL");
  if (url) {
    return { url, source: "PRISMA_DATABASE_URL" };
  }
  url = parseEnvKeyFromFile(apiEnv, "PRISMA_DATABASE_URL");
  if (url) {
    return { url, source: "PRISMA_DATABASE_URL" };
  }
  const fallback = resolveDatabaseUrl(e);
  if (fallback) {
    return { url: fallback, source: "DATABASE_URL" };
  }
  return { url: "", source: "" };
}

const { url: dbUrl, source: prismaUrlSource } = resolvePrismaDatabaseUrl(env);
if (!dbUrl) {
  console.error(
    [
      "prisma-run: DATABASE_URL est vide.",
      "Renseigne DATABASE_URL dans le .env a la racine du monorepo,",
      "ou les champs Docker POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB (sans config Supabase),",
      "ou DB_HOST / DB_USER / DB_PASSWORD / DB_NAME."
    ].join("\n")
  );
  process.exit(1);
}
if (prismaUrlSource === "PRISMA_DATABASE_URL") {
  console.error(
    "prisma-run: utilisation de PRISMA_DATABASE_URL (connexion directe recommandee pour migrate / db push)."
  );
}
env.DATABASE_URL = dbUrl;

// Résoudre DIRECT_URL (connexion directe, port 5432) pour le champ directUrl du schema.prisma.
// Même logique que DATABASE_URL : variable système vide ignorée, lecture fichier en fallback.
function resolveDirectUrl(e) {
  let url = stripOuterQuotes(e.DIRECT_URL);
  if (url) return url;
  url = parseEnvKeyFromFile(rootEnv, "DIRECT_URL");
  if (url) return url;
  url = parseEnvKeyFromFile(apiEnv, "DIRECT_URL");
  if (url) return url;
  return "";
}
const directUrl = resolveDirectUrl(env);
if (directUrl) {
  env.DIRECT_URL = directUrl;
}

const prismaPkgDir = path.dirname(require.resolve("prisma/package.json"));
const prismaCli = path.join(prismaPkgDir, "build", "index.js");
const prismaArgs = process.argv.slice(2);

const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs], {
  env,
  stdio: "inherit",
  cwd: apiRoot
});

process.exit(result.status === null ? 1 : result.status);
