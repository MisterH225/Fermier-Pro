import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "vet-credentials";

/**
 * Téléverse diplôme vétérinaire (JPG/PNG/PDF) — bucket `vet-credentials` (public read recommandé pour admin).
 * `storageOwnerId` = `auth.users.id` (JWT `sub`), aligné sur les politiques RLS (`diplomas/{uid}/…`).
 */
export async function uploadVetDiplomaToSupabase(
  supabase: SupabaseClient,
  storageOwnerId: string,
  localUri: string,
  mimeType: string
): Promise<string> {
  const lower = mimeType.toLowerCase();
  const ext = lower.includes("pdf")
    ? "pdf"
    : lower.includes("png")
      ? "png"
      : "jpg";
  const path = `diplomas/${storageOwnerId}/${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const buf = await response.arrayBuffer();
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: mimeType || "image/jpeg",
    upsert: false
  });
  if (upErr) {
    throw upErr;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
