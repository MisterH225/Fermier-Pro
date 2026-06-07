import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "vet-credentials";

/**
 * Téléverse diplôme vétérinaire (JPG/PNG/PDF) — bucket `vet-credentials` (privé).
 * L’URL retournée sert de référence en base ; l’accès admin passe par URL signée côté API.
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
