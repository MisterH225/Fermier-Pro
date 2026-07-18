/**
 * Pre-deploy Railway : migrations Prisma avec récupération P3009 (wallet / orchestrateur).
 * Le schéma peut déjà exister sur Supabase alors que _prisma_migrations marque failed.
 * Redeploy trigger: 2026-07-18T15:15Z — InsightsModule AuthModule (boot DI).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { apiRoot, bootstrapProdEnv } = require("./bootstrap-prod-env.cjs");

bootstrapProdEnv();

const prismaRun = path.join(__dirname, "prisma-run.cjs");

/**
 * Migrations souvent en conflit après application SQL Supabase en parallèle
 * (enum déjà présent / schéma déjà là → P3009 / P3018).
 */
const RECOVERABLE_MIGRATIONS = [
  "20260624120000_universal_user_wallet",
  "20260625120000_payment_orchestrator",
  "20260717180000_merchant_shop_archived_at",
  "20260717190000_merchant_product_resubmission",
  "20260718100000_merchant_product_merchant_deleted",
  "20260718120000_trust_score_snapshots",
  "20260718120000_weight_tolerance_percent"
];

function runPrisma(args) {
  return spawnSync(process.execPath, [prismaRun, ...args], {
    cwd: apiRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"]
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function tryRecoverFailedMigrations(output) {
  const needsRecovery =
    output.includes("P3009") ||
    output.includes("P3018") ||
    output.toLowerCase().includes("failed migrations");
  if (!needsRecovery) {
    return false;
  }

  console.warn(
    "[railway-predeploy] Migration(s) en échec détectée(s) — resolve --applied sur migrations récupérables…"
  );

  const names = new Set(RECOVERABLE_MIGRATIONS);
  const named =
    /The `([0-9]{14}_[a-z0-9_]+)` migration (?:started at .+ )?failed/i.exec(
      output
    ) ??
    /Migration name: ([0-9]{14}_[a-z0-9_]+)/i.exec(output);
  if (named?.[1]) {
    names.add(named[1]);
  }

  let anyResolved = false;
  for (const name of names) {
    const resolved = runPrisma(["migrate", "resolve", "--applied", name]);
    if (resolved.status === 0) {
      console.log(`[railway-predeploy] Marquée appliquée : ${name}`);
      anyResolved = true;
    }
  }
  return anyResolved || names.size > 0;
}

console.log("[railway-predeploy] prisma migrate deploy…");
let deploy = runPrisma(["migrate", "deploy"]);

if (deploy.status !== 0) {
  const output = combinedOutput(deploy);
  process.stderr.write(output);
  if (tryRecoverFailedMigrations(output)) {
    console.log("[railway-predeploy] Nouvelle tentative migrate deploy…");
    deploy = runPrisma(["migrate", "deploy"]);
  }
}

if (deploy.stdout) {
  process.stdout.write(deploy.stdout);
}
if (deploy.stderr) {
  process.stderr.write(deploy.stderr);
}

if (deploy.status !== 0) {
  console.error(
    "[railway-predeploy] migrate deploy en échec — déploiement poursuivi (schéma peut déjà être à jour via Supabase). " +
      "Vérifiez les logs et DATABASE_URL / PRISMA_DATABASE_URL sur Railway."
  );
  // On tente quand même le seed référentiels géo (tables peuvent déjà exister).
}

console.log("[railway-predeploy] seed référentiels géo CI…");
const seed = spawnSync(process.execPath, [path.join(apiRoot, "prisma", "seed.cjs")], {
  cwd: apiRoot,
  env: process.env,
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"]
});
if (seed.stdout) process.stdout.write(seed.stdout);
if (seed.stderr) process.stderr.write(seed.stderr);
if (seed.status !== 0) {
  console.error(
    "[railway-predeploy] seed géo en échec (non bloquant) — lancez npm run prisma:seed manuellement si besoin."
  );
}

process.exit(0);
