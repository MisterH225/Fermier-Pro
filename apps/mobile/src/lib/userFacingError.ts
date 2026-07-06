import type { TFunction } from "i18next";

const TECHNICAL_RE =
  /network request failed|failed to fetch|econnrefused|timeout|unauthorized|forbidden|jwt|localhost|127\.0\.0\.1|\bapi\b|endpoint|http\/|fetch\s|prisma|sql|stack trace|typeerror|syntaxerror|\b401\b|\b403\b|\b404\b|\b500\b|internal server/i;

function rawMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  if (err != null) {
    return String(err);
  }
  return "";
}

function isTechnical(msg: string): boolean {
  const trimmed = msg.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.length > 160) {
    return true;
  }
  return TECHNICAL_RE.test(trimmed);
}

/** Message d'erreur sûr pour l'UI — jamais de détail technique en production. */
export function getUserFacingError(err: unknown, t: TFunction): string {
  const raw = rawMessage(err).trim();
  if (!raw) {
    return t("common.errors.generic");
  }

  const lower = raw.toLowerCase();
  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout")
  ) {
    return t("common.errors.network");
  }
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("jeton invalide") ||
    lower.includes("jeton refusé")
  ) {
    return t("common.errors.unauthorized");
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return t("common.errors.forbidden");
  }
  if (
    /^transaction introuvable/i.test(raw) ||
    /^offre introuvable/i.test(raw) ||
    /^paiement geniuspay/i.test(raw) ||
    /^montant à payer/i.test(raw) ||
    /^paiement mobile money/i.test(raw)
  ) {
    return raw;
  }
  if (lower.includes("404") || lower.includes("not found") || lower.includes("introuvable")) {
    return t("common.errors.notFound");
  }

  if (__DEV__ && !isTechnical(raw)) {
    return raw;
  }

  if (isTechnical(raw)) {
    return t("common.errors.generic");
  }

  return raw;
}

/** Résout une erreur React Query ou mutation pour affichage. */
export function getQueryErrorMessage(
  err: unknown,
  t: TFunction
): string | null {
  if (!err) {
    return null;
  }
  return getUserFacingError(err, t);
}
