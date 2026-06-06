import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "listings";
const MAX_BYTES = 5 * 1024 * 1024;

/** Téléverse une photo d’annonce vers le bucket public `listings`. */
export async function uploadListingPhotoToSupabase(
  supabase: SupabaseClient,
  farmId: string,
  localUri: string,
  mimeType: string,
  listingId?: string
): Promise<string> {
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const folder = listingId ?? "draft";
  const path = `farms/${farmId}/${folder}/${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const buf = await response.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("Photo trop volumineuse (max 5 Mo)");
  }
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

/** Retire une photo du bucket `listings` à partir de son URL publique. */
export async function deleteListingPhotoFromSupabase(
  supabase: SupabaseClient,
  publicUrl: string
): Promise<void> {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) {
    return;
  }
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  if (!path) {
    return;
  }
  await supabase.storage.from(BUCKET).remove([path]);
}
