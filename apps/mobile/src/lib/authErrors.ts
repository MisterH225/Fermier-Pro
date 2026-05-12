/** Messages d’erreur lisibles pour l’écran de connexion (SMS, OAuth, etc.). */
export function formatAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.toLowerCase();
  if (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("network error")
  ) {
    return (
      "Impossible de joindre Supabase (réseau ou URL). Vérifie la connexion internet, " +
      "que EXPO_PUBLIC_SUPABASE_URL dans apps/mobile/.env est exactement l’URL du projet " +
      "(https://….supabase.co), puis redémarre Expo après modification du .env. " +
      "Sans SMS en local : ajoute EXPO_PUBLIC_AUTH_BYPASS=true pour le mode démo."
    );
  }
  if (m.includes("annulée") || m.includes("cancel")) {
    return raw;
  }
  return raw;
}
