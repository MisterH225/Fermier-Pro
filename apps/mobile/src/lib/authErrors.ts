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
  if (m.includes("flow state") || m.includes("code verifier")) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      return (
        "Connexion Google interrompue. Ferme Safari, relance Expo (--clear), puis réessaie une seule fois."
      );
    }
    return (
      "Connexion Google interrompue. Ferme l’app complètement, rouvre-la, puis réessaie une seule fois."
    );
  }
  if (m.includes("sms") && (m.includes("hook") || m.includes("provider") || m.includes("failed"))) {
    return (
      "Impossible d’envoyer le SMS pour le moment. Réessaie dans quelques minutes. " +
      "Si le problème persiste, l’équipe doit vérifier la configuration Yellika SMS sur le serveur."
    );
  }
  if (m.includes("invalid phone") || m.includes("phone number")) {
    return "Numéro de téléphone invalide. Vérifie l’indicatif pays et le numéro saisi.";
  }
  if (m.includes("otp") && (m.includes("expired") || m.includes("invalid"))) {
    return "Code incorrect ou expiré. Demande un nouveau code et réessaie.";
  }
  if (m.includes("rate limit") || m.includes("too many") || m.includes("over_email_send_rate_limit")) {
    return "Trop de tentatives. Attends une minute avant de redemander un code.";
  }
  if (m.includes("signup") && m.includes("disabled")) {
    return "L’inscription par téléphone n’est pas activée sur ce projet. Contacte le support.";
  }
  return raw;
}
