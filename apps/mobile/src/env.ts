import Constants from "expo-constants";

/**
 * Variables Expo : prefixe EXPO_PUBLIC_ (injectees au build / dev).
 * Fichier `.env` a la racine de `apps/mobile/` (voir `.env.example`).
 */
export function getExpoPublicEnv() {
  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
  };
}

function isPlaceholderSupabaseUrl(url: string): boolean {
  const u = url.trim();
  return (
    !u ||
    u.includes("<") ||
    u.includes(">") ||
    /project-ref|your-project|example\.com/i.test(u)
  );
}

export function isAuthEnvConfigured(): boolean {
  const e = getExpoPublicEnv();
  return !!(
    e.supabaseUrl &&
    e.supabaseAnonKey &&
    !isPlaceholderSupabaseUrl(e.supabaseUrl)
  );
}

export function isApiUrlConfigured(): boolean {
  return !!getExpoPublicEnv().apiUrl;
}

function apiPortFromConfiguredUrl(configured: string): string {
  if (!configured) {
    return "3000";
  }
  try {
    const u = new URL(configured.includes("://") ? configured : `http://${configured}`);
    return u.port || "3000";
  } catch {
    return "3000";
  }
}

/**
 * URL de l’API Nest joignable depuis le téléphone.
 * En dev Expo Go : utilise l’IP LAN de Metro (`hostUri`, ex. 192.168.1.44) + le port de
 * EXPO_PUBLIC_API_URL (souvent 3000), pour éviter une IP obsolète dans le .env.
 */
export function resolveApiBaseUrl(): string {
  const configured = getExpoPublicEnv().apiUrl.trim().replace(/\/$/, "");
  const port = apiPortFromConfiguredUrl(configured);

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const hostUri = Constants.expoConfig?.hostUri?.trim();
    if (hostUri) {
      const host = hostUri.split(":")[0]?.trim();
      if (host && !/localhost|127\.0\.0\.1/i.test(host)) {
        return `http://${host}:${port}`;
      }
    }
  }

  if (!configured) {
    throw new Error("EXPO_PUBLIC_API_URL manquant");
  }
  return configured.includes("://") ? configured : `http://${configured}`;
}
