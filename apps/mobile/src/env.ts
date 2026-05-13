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

/**
 * Affiche le parcours « sans compte » (mode démo) : en build dev Metro (`__DEV__`),
 * ou si `EXPO_PUBLIC_AUTH_BYPASS=true` (utile pour un build release de démo interne).
 */
export function isDemoNavigationOffered(): boolean {
  return (
    (typeof __DEV__ !== "undefined" && __DEV__) || isAuthBypassEnabled()
  );
}

/**
 * Metro / dev client uniquement (`__DEV__` à l’exécution) : jeton Bearer réel (ex. `access_token`
 * Supabase) utilisé à la place du jeton factice quand l’utilisateur choisit « Explorer — mode démo ».
 * Permet de tester l’API Nest sans flux OTP, tout en gardant l’entrée démo.
 *
 * Ne jamais définir cette variable pour un build store : `EXPO_PUBLIC_*` peut être embarqué dans le JS.
 */
export function getDevBypassApiAccessToken(): string | null {
  if (typeof __DEV__ === "undefined" || !__DEV__) {
    return null;
  }
  const t = (
    process.env.EXPO_PUBLIC_DEV_BYPASS_API_ACCESS_TOKEN ?? ""
  ).trim();
  return t.length > 0 ? t : null;
}

/**
 * Metro uniquement : désactive `tryDemoBypassApiGetJson` (les GET partent en `fetch` réel).
 * Utile avec `EXPO_PUBLIC_DEV_BYPASS_API_ACCESS_TOKEN` ou pour vérifier les erreurs réseau / 401.
 */
export function isDemoApiGetMockDisabled(): boolean {
  if (typeof __DEV__ === "undefined" || !__DEV__) {
    return false;
  }
  const v = (
    process.env.EXPO_PUBLIC_DEMO_DISABLE_API_GET_MOCK ?? ""
  ).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
