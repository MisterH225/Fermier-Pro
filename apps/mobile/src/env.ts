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

export function isAuthEnvConfigured(): boolean {
  const e = getExpoPublicEnv();
  return !!(e.supabaseUrl && e.supabaseAnonKey);
}

export function isApiUrlConfigured(): boolean {
  return !!getExpoPublicEnv().apiUrl;
}

/**
 * Si `EXPO_PUBLIC_AUTH_BYPASS=true` (ou `1`), l’écran de connexion affiche un accès
 * « mode démo » pour naviguer dans l’app sans Supabase Auth configuré (dev uniquement).
 */
export function isAuthBypassEnabled(): boolean {
  const v = (process.env.EXPO_PUBLIC_AUTH_BYPASS ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
