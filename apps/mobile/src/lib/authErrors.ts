import {
  isAuthApiError,
  isAuthRetryableFetchError
} from "@supabase/supabase-js";
import { formatApiError } from "./apiErrors";

const SMS_UNAVAILABLE =
  "Impossible d’envoyer le SMS pour le moment. Vérifie ton numéro (+225…) puis réessaie dans une minute. " +
  "Si le problème persiste, le service SMS (Yellika) doit être vérifié côté serveur.";

function looksLikeFetchResponseJson(raw: string): boolean {
  const t = raw.trim();
  return (
    t.startsWith("{") &&
    t.includes('"status"') &&
    (t.includes("/auth/v1/otp") || t.includes('"ok":false'))
  );
}

function friendlySmsProviderMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("unauthenticated") || m.includes("invalid token")) {
    return "Configuration SMS invalide (token Yellika). Contacte le support Fermier Pro.";
  }
  if (
    m.includes("sender") ||
    m.includes("sender_id") ||
    m.includes("sender id") ||
    m.includes("expéditeur") ||
    m.includes("expediteur")
  ) {
    if (m.includes("autorise") || m.includes("autorisé")) {
      return (
        "L’expéditeur SMS (sender ID) n’est pas autorisé pour ce type de message OTP. " +
        "Demandez à Yellika d’activer l’envoi « transactionnel / OTP » pour votre sender ID, " +
        "ou enregistrez le modèle de message validé."
      );
    }
    return "Configuration SMS invalide (sender ID Yellika). Contacte le support Fermier Pro.";
  }
  if (
    m.includes("insufficient") ||
    m.includes("balance") ||
    m.includes("credit") ||
    m.includes("solde")
  ) {
    return "Crédit SMS épuisé sur le compte Yellika. Réessaie plus tard ou contacte le support.";
  }
  if (m.includes("signature webhook")) {
    return "Configuration SMS invalide (secret hook Supabase). Contacte le support Fermier Pro.";
  }
  if (m.includes("yellika") || m.includes("échec envoi sms")) {
    return message.replace(/^Échec envoi SMS Yellika:\s*/i, "SMS non envoyé : ");
  }
  if (m.includes("hook")) {
    return SMS_UNAVAILABLE;
  }
  return message;
}

/** Messages d’erreur lisibles pour l’écran de connexion (SMS, OAuth, etc.). */
export function formatAuthError(err: unknown): string {
  if (isAuthApiError(err)) {
    const msg = err.message?.trim();
    if (msg) {
      return friendlySmsProviderMessage(msg);
    }
  }

  if (isAuthRetryableFetchError(err)) {
    if (err.status === 503 || err.status === 502 || err.status === 504) {
      return SMS_UNAVAILABLE;
    }
    const msg = err.message?.trim();
    if (msg && !looksLikeFetchResponseJson(msg)) {
      return friendlySmsProviderMessage(msg);
    }
    return SMS_UNAVAILABLE;
  }

  const raw = err instanceof Error ? err.message : String(err);
  if (looksLikeFetchResponseJson(raw)) {
    return SMS_UNAVAILABLE;
  }

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
    return SMS_UNAVAILABLE;
  }
  if (m.includes("invalid phone") || m.includes("phone number")) {
    return "Numéro de téléphone invalide. Vérifie l’indicatif pays et le numéro saisi.";
  }
  if (m.includes("otp") && (m.includes("expired") || m.includes("invalid"))) {
    return "Code incorrect ou expiré. Demande un nouveau code et réessaie.";
  }
  if (
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("over_email_send_rate_limit")
  ) {
    return "Trop de tentatives. Attends une minute avant de redemander un code.";
  }
  if (m.includes("signup") && m.includes("disabled")) {
    return "L’inscription par téléphone n’est pas activée sur ce projet. Contacte le support.";
  }
  if (m.includes("service currently unavailable")) {
    return SMS_UNAVAILABLE;
  }
  return raw.length > 280 ? SMS_UNAVAILABLE : raw;
}
