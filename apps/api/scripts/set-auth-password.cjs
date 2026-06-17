/**
 * Définit ou réinitialise le mot de passe Supabase Auth d'un utilisateur.
 * Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env (Dashboard → Settings → API).
 *
 * Usage :
 *   node scripts/set-auth-password.cjs --email user@example.com
 *   node scripts/set-auth-password.cjs --email user@example.com --password MonMotDePasse123
 */
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const apiRoot = path.join(__dirname, "..");
const repoRoot = path.join(__dirname, "..", "..", "..");

for (const envPath of [path.join(repoRoot, ".env"), path.join(apiRoot, ".env")]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const { PrismaClient } = require("@prisma/client");

function parseArgs(argv) {
  const out = { email: null, userId: null, password: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--email" && argv[i + 1]) out.email = argv[++i];
    else if (arg === "--user-id" && argv[i + 1]) out.userId = argv[++i];
    else if (arg === "--password" && argv[i + 1]) out.password = argv[++i];
    else if (arg === "-h" || arg === "--help") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`Définir le mot de passe Supabase Auth

Options :
  --email <adresse>       Email utilisateur
  --user-id <uuid>        Id Supabase Auth (auth.users.id)
  --password <motdepasse> Mot de passe (obligatoire — aucune valeur par défaut)
  -h, --help

Requis dans .env : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const base = process.env.SUPABASE_URL?.trim()?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !serviceKey) {
    console.error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env (clé service_role secrète)."
    );
    process.exit(1);
  }
  if (!args.email && !args.userId) {
    printHelp();
    process.exit(1);
  }
  if (!args.password) {
    console.error("--password est obligatoire. Aucune valeur par défaut pour des raisons de sécurité.");
    process.exit(1);
  }
  if (args.password.length < 12) {
    console.error("Le mot de passe doit faire au moins 12 caractères.");
    process.exit(1);
  }

  let authUserId = args.userId;
  if (!authUserId && args.email) {
    const prisma = new PrismaClient();
    try {
      const user = await prisma.user.findFirst({
        where: { email: args.email },
        select: { supabaseUserId: true, email: true }
      });
      if (!user?.supabaseUserId) {
        console.error("Utilisateur Prisma introuvable pour cet email.");
        process.exit(1);
      }
      authUserId = user.supabaseUserId;
    } finally {
      await prisma.$disconnect();
    }
  }

  const res = await fetch(`${base}/auth/v1/admin/users/${authUserId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      password: args.password,
      email_confirm: true
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Échec (${res.status}): ${text.slice(0, 300)}`);
    process.exit(1);
  }

  console.log("Mot de passe Supabase mis à jour.");
  console.log(`  authUserId: ${authUserId}`);
  console.log(`  email:      ${args.email ?? "—"}`);
  // Ne pas logger le mot de passe en clair
  console.log("\nConnexion : http://localhost:3001/fr/login");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
