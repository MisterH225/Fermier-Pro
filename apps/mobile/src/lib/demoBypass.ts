import type { AuthMeResponse } from "./api";

/** Ferme factice listée en mode démo pour ouvrir les écrans ferme sans API. */
export const DEMO_PREVIEW_FARM_ID = "00000000-0000-4000-8000-0000000000f0";

/** Jeton factice passé à `SessionProvider` quand le bypass dev est actif. */
export const DEMO_BYPASS_ACCESS_TOKEN = "__FERMIER_PRO_DEMO_BYPASS__";

/** Données utilisateur / profils minimales pour naviguer dans l’UI sans API Supabase. */
export const DEMO_AUTH_ME: AuthMeResponse = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    supabaseUserId: "demo-supabase-sub",
    email: "demo@fermier-pro.local",
    phone: null,
    fullName: "Explorateur démo",
    isActive: true
  },
  profiles: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      type: "producer",
      displayName: "Profil producteur démo",
      isDefault: true
    }
  ],
  activeProfile: {
    id: "00000000-0000-4000-8000-000000000002",
    type: "producer",
    displayName: "Profil producteur démo",
    isDefault: true
  }
};

export function isDemoBypassToken(token: string): boolean {
  return token === DEMO_BYPASS_ACCESS_TOKEN;
}
