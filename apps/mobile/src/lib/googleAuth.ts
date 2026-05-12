import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * URL de redirection OAuth (à déclarer dans Supabase : Authentication → URL configuration
 * → Redirect URLs). Doit correspondre au `scheme` Expo (`fermier-pro`).
 * Utilise `expo-linking` plutôt que `expo-auth-session` pour éviter des erreurs Metro
 * (`Unable to resolve ./AuthSession`) dans certains monorepos.
 */
export function getGoogleOAuthRedirectUri(): string {
  return Linking.createURL("auth/callback", { scheme: "fermier-pro" });
}
async function finishOAuthFromReturnUrl(
  supabase: SupabaseClient,
  returnUrl: string
): Promise<void> {
  if (returnUrl.includes("code=")) {
    const { error } = await supabase.auth.exchangeCodeForSession(returnUrl);
    if (error) {
      throw error;
    }
    return;
  }

  const hash = returnUrl.includes("#") ? returnUrl.split("#")[1] : "";
  if (hash) {
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
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
  }

  throw new Error(
    "Réponse Google inattendue. Vérifie les Redirect URLs Supabase (scheme fermier-pro)."
  );
}

/**
 * Lance le flux OAuth Google (navigateur in-app) puis enregistre la session Supabase.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase non configuré");
  }

  const redirectTo = getGoogleOAuthRedirectUri();

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });

  if (oauthError) {
    throw oauthError;
  }
  if (!data?.url) {
    throw new Error("Impossible d’ouvrir la page de connexion Google.");
  }

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.assign(data.url);
    }
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "cancel") {
    throw new Error("Connexion Google annulée.");
  }
  if (result.type !== "success" || !("url" in result) || !result.url) {
    throw new Error("Connexion Google interrompue.");
  }

  await finishOAuthFromReturnUrl(supabase, result.url);
}
