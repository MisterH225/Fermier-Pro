import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getExpoPublicEnv } from "../env";

let client: SupabaseClient | null = null;

/** Client Supabase auth ; null si URL / anon key absents. */
export function getSupabase(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getExpoPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }
  return client;
}
