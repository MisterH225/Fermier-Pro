import { formatApiError } from "./apiErrors";

/** Messages d’erreur lisibles pour l’écran de connexion (SMS, OAuth, etc.). */
export function formatAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.toLowerCase();
  if (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("network error")
  ) {
    if (m.includes("/api/v1") || m.includes("api nest") || m.includes("injoignable")) {
      return formatApiError(err);
    }
    return (
      "Impossible de joindre Supabase (réseau ou URL). Vérifie la connexion internet, " +
      "que EXPO_PUBLIC_SUPABASE_URL dans apps/mobile/.env est exactement l’URL du projet " +
      "(https://….supabase.co), puis redémarre Expo après modification du .env."
    );
  }
  if (m.includes("annulée") || m.includes("cancel")) {
    return raw;
  }
  if (m.includes("flow state")) {
    return (
      "Connexion Google interrompue. Ferme Safari, relance Expo (--clear), puis réessaie une seule fois."
    );
  }
  if (m.includes("jetons dans l’url") || m.includes("incomplete")) {
    return raw;
  }
  return raw;
}
