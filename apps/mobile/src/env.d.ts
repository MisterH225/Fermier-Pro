declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_AUTH_BYPASS?: string;
    EXPO_PUBLIC_DEV_BYPASS_API_ACCESS_TOKEN?: string;
    EXPO_PUBLIC_DEMO_DISABLE_API_GET_MOCK?: string;
    /** Base URL HTTPS pour les Universal Link `/invite/<token>` (sinon schéma `fermier-pro://`). */
    EXPO_PUBLIC_INVITE_BASE_URL?: string;
  }
}
