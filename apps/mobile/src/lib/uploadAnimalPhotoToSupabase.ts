import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "animal-photos";

/** Téléverse une photo de sujet vers le bucket public `animal-photos`. */
export async function uploadAnimalPhotoToSupabase(
  supabase: SupabaseClient,
  farmId: string,
  animalId: string,
  localUri: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const path = `farms/${farmId}/animals/${animalId}-${Date.now()}.${ext}`;
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
