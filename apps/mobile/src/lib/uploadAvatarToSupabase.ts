import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATARS_BUCKET = "avatars";

/**
 * Téléverse une image locale vers le bucket Supabase `avatars` (public).
 * `storageOwnerId` = `auth.users.id` (JWT `sub`), dossier aligné sur les politiques RLS.
 * Créer le bucket : `supabase/migrations/20260519120000_storage_buckets.sql`.
 */
export async function uploadUserAvatarToSupabase(
  supabase: SupabaseClient,
  storageOwnerId: string,
  localUri: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const path = `${storageOwnerId}/avatar.${ext}`;
  const response = await fetch(localUri);
  const buf = await response.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, buf, {
      contentType: mimeType || "image/jpeg",
      upsert: true
    });
  if (upErr) {
    if (
      upErr.message?.includes("Bucket not found") ||
      upErr.message?.includes("bucket")
    ) {
      throw new Error(
        `Bucket Supabase « ${AVATARS_BUCKET} » introuvable. Exécute la migration storage dans le SQL Editor Supabase (voir docs/SUPABASE_AUTH.md).`
      );
    }
    throw upErr;
  }
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
