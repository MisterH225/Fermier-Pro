/**
 * Helpers pour la recherche/affichage d'utilisateurs par identifiant
 * (téléphone ou email). Aucune logique métier — uniquement normalisation
 * et masquage stricts (pas d'exposition de données complètes).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type IdentifierKind = "email" | "phone";

export function detectIdentifierKind(raw: string): IdentifierKind | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return "email";
  if (/[\d+]/.test(trimmed)) return "phone";
  return null;
}

/**
 * Normalisation E.164-like : on retire les espaces, tirets et parenthèses,
 * et on impose un préfixe `+`. Renvoie null si le résultat n'est pas un
 * numéro plausible (au moins 8 chiffres après le `+`).
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  const digits = withPlus.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length < 8 || digits.length > 16) return null;
  return withPlus;
}

export function normalizeEmail(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(lower)) return null;
  return lower;
}

/** Affiche `j***@gmail.com` (1er caractère + 3 étoiles + domaine). */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);
  return `${head}***${domain}`;
}

/** Affiche `+225 07 ** ** ** **` : code pays + 2 premiers chiffres + étoiles. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 4) return "***";
  // Devine le code pays : 1 chiffre (US) ou 2-3 chiffres (FR/CI/...).
  // Approche simple : prend les 3 premiers chiffres comme code, puis 2 chiffres clairs,
  // puis masque le reste par groupes de 2.
  const cc = digits.slice(0, 3);
  const head = digits.slice(3, 5);
  const tail = digits.slice(5);
  const masked = tail.replace(/\d/g, "*").replace(/(.{2})/g, "$1 ").trim();
  return `+${cc} ${head} ${masked}`.trim();
}

/** Prénom + 1re lettre du nom — ex. "Jean D.". */
export function maskFullName(
  firstName: string | null,
  lastName: string | null
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first && !last) return "";
  if (!last) return first;
  return `${first || "?"} ${last.charAt(0).toUpperCase()}.`;
}
