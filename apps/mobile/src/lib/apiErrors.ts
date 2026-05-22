import Constants from "expo-constants";
import { resolveApiBaseUrl } from "../env";

/** Message lisible quand l’API Nest est injoignable après connexion Supabase. */
export function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.toLowerCase();

  if (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m === "network error" ||
    m.includes("econnrefused") ||
    m.includes("timeout")
  ) {
    let apiHint = "";
    try {
      apiHint = resolveApiBaseUrl();
    } catch {
      apiHint = "(EXPO_PUBLIC_API_URL non configuré)";
    }
    const metro = Constants.expoConfig?.hostUri ?? "—";
    return (
      `Connexion Google OK, mais l’API Nest est injoignable (${apiHint}).\n\n` +
      `• Lance l’API : depuis la racine du projet, npm run start:dev (ou cd apps/api && npm run start:dev)\n` +
      `• Même Wi‑Fi que le téléphone\n` +
      `• Mets à jour apps/mobile/.env : EXPO_PUBLIC_API_URL=http://<IP-du-PC>:3000 (Expo Metro : ${metro})\n` +
      `• Redémarre Expo avec npx expo start --clear`
    );
  }

  if (m.includes("401") || m.includes("unauthorized") || m.includes("jeton invalide")) {
    return (
      "Jeton refusé par l’API. Vérifie SUPABASE_URL dans le .env racine (URL du projet Supabase). " +
      "Les connexions Google utilisent ES256 (clés JWKS) — pas le champ « Key ID » du dashboard. " +
      "Redémarre l’API après modification du .env."
    );
  }

  return raw;
}
