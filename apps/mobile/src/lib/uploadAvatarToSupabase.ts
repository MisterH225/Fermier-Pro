import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Téléverse une image locale vers le bucket Supabase `avatars` (public).
 * Crée le bucket côté Supabase + politiques RLS si besoin.
 */
export async function uploadUserAvatarToSupabase(
  supabase: SupabaseClient,
  userId: string,
  localUri: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const path = `${userId}/avatar.${ext}`;
  const response = await fetch(localUri);
  const buf = await response.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, buf, {
      contentType: mimeType || "image/jpeg",
      upsert: true
    });
  if (upErr) {
    throw upErr;
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
