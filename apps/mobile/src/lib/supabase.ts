import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { getExpoPublicEnv } from "../env";
import { supabaseSecureStorage } from "./supabaseSecureStorage";

let client: SupabaseClient | null = null;

/**
 * Mobile : flux **implicit** (tokens dans l’URL → setSession), recommandé par Supabase
 * pour Expo — évite « invalid flow state » du PKCE.
 * Web : PKCE.
 */
function authFlowType(): "pkce" | "implicit" {
  return Platform.OS === "web" ? "pkce" : "implicit";
}

/** Client Supabase auth ; null si URL / anon key absents. */
export function getSupabase(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getExpoPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!client) {
    const storage =
      Platform.OS === "web"
        ? undefined
        : supabaseSecureStorage;
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        ...(storage ? { storage } : {}),
        flowType: authFlowType(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }
  return client;
}
