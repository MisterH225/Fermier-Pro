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
