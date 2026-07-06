import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "listings";
const MAX_BYTES = 5 * 1024 * 1024;

/** Photo preuve de pesée marketplace (bucket public listings). */
export async function uploadMarketplaceWeightPhotoToSupabase(
  supabase: SupabaseClient,
  listingId: string,
  transactionId: string,
  localUri: string,
  mimeType: string,
  animalId?: string
): Promise<string> {
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const safeTx = transactionId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32);
  const safeAnimal = (animalId ?? "total").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24);
  const safeListing = listingId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32);
  const path = `listings/${safeListing}/marketplace-weights/${safeTx}/${safeAnimal}-${Date.now()}.${ext}`;
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
