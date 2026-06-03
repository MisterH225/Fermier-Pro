import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const OAUTH_CALLBACK_PATH = "auth/callback";

let oauthSessionPromise: Promise<void> | null = null;

function isLocalhostish(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function getGoogleOAuthRedirectUri(): string {
  // Dans un vrai build (TestFlight, APK) — jamais de exp://
  // On utilise toujours le scheme de l'app
  if (Platform.OS !== "web") {
    return `fermier-pro://${OAUTH_CALLBACK_PATH}`;
  }
  // Web uniquement
  return Linking.createURL(OAUTH_CALLBACK_PATH);
}

function parseUrlParams(url: string): URLSearchParams {
  const hash = url.includes("#") ? url.split("#")[1] : "";
  const query = url.includes("?") ? url.split("?")[1]?.split("#")[0] ?? "" : "";
  const combined = hash || query;
  return new URLSearchParams(combined);
}

function parseOAuthError(url: string): string | null {
  const params = parseUrlParams(url);
  const code = params.get("error_code") ?? params.get("error");
  if (!code) {
    return null;
  }
  return (
    params.get("error_description") ??
    params.get("error") ??
    "Erreur OAuth"
  );
}

function extractTokensFromReturnUrl(returnUrl: string): {
  access_token: string | null;
  refresh_token: string | null;
} {
  const params = parseUrlParams(returnUrl);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token")
  };
}

/**
 * Crée la session depuis l’URL de retour (flux implicit mobile, doc Supabase).
 * @see https://supabase.com/docs/guides/auth/native-mobile-deep-linking
 */
async function createSessionFromOAuthUrl(
  supabase: SupabaseClient,
  returnUrl: string
): Promise<void> {
  const oauthError = parseOAuthError(returnUrl);
  if (oauthError) {
    throw new Error(oauthError);
  }

  const { access_token, refresh_token } = extractTokensFromReturnUrl(returnUrl);

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });
    if (error) {
      throw error;
    }
    return;
  }

  if (Platform.OS === "web") {
    const params = parseUrlParams(returnUrl);
    const code = params.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(returnUrl);
      if (error) {
        throw error;
      }
      return;
    }
  }

  throw new Error(
    "Réponse Google incomplète (pas de jetons dans l’URL). Vérifie Site URL et Redirect URLs Supabase (exp://…, pas localhost)."
  );
}

async function createSessionFromOAuthUrlOnce(
  supabase: SupabaseClient,
  returnUrl: string
): Promise<void> {
  if (oauthSessionPromise) {
    return oauthSessionPromise;
  }
  oauthSessionPromise = createSessionFromOAuthUrl(supabase, returnUrl).finally(() => {
    oauthSessionPromise = null;
  });
  return oauthSessionPromise;
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase non configuré");
  }

  const redirectTo = getGoogleOAuthRedirectUri();
  if (Platform.OS !== "web" && isLocalhostish(redirectTo)) {
    throw new Error(
      "Redirect OAuth en localhost : sur iPhone, lance Expo en mode LAN (même Wi‑Fi que le PC)."
    );
  }

  const useInAppBrowser = Platform.OS !== "web";
  if (useInAppBrowser) {
    await WebBrowser.warmUpAsync();
  }

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });

  if (oauthError) {
    throw oauthError;
  }

  const oauthUrl = data?.url?.trim();
  if (!oauthUrl || !oauthUrl.startsWith("https://")) {
    throw new Error(
      "Impossible d’ouvrir Google : vérifie EXPO_PUBLIC_SUPABASE_URL dans apps/mobile/.env."
    );
  }

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.assign(oauthUrl);
    }
    return;
  }

  try {
    const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectTo, {
      showInRecents: true
    });

    if (result.type === "cancel") {
      throw new Error("Connexion Google annulée.");
    }
    if (result.type !== "success" || !("url" in result) || !result.url) {
      throw new Error(
        "Connexion interrompue. Vérifie Redirect URLs et Site URL dans Supabase (URL exp://… affichée sur l’écran de connexion)."
      );
    }

    await createSessionFromOAuthUrlOnce(supabase, result.url);
  } finally {
    if (useInAppBrowser) {
      void WebBrowser.coolDownAsync();
    }
  }
}
