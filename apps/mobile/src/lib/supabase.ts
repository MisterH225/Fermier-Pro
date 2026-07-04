import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { getExpoPublicEnv } from "../env";
import { supabaseSecureStorage } from "./supabaseSecureStorage";

let client: SupabaseClient | null = null;

/** PKCE sur toutes les plateformes (Expo SDK 54+). */
function authFlowType(): "pkce" {
  return "pkce";
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
        detectSessionInUrl: Platform.OS === "web"
      }
    });
  }
  return client;
}
