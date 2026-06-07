declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    /** Base URL HTTPS pour les Universal Link `/invite/<token>` (sinon schéma `fermier-pro://`). */
    EXPO_PUBLIC_INVITE_BASE_URL?: string;
  }
}
