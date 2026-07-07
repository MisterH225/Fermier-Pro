import type { SupabaseClient } from "@supabase/supabase-js";

export const MERCHANT_PRODUCTS_BUCKET = "merchant-products";
const MAX_BYTES = 5 * 1024 * 1024;

/** Téléverse une photo produit commerçant vers le bucket public `merchant-products`. */
export async function uploadMerchantProductPhotoToSupabase(
  supabase: SupabaseClient,
  shopId: string,
  localUri: string,
  mimeType: string,
  productId?: string
): Promise<string> {
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const folder = productId ?? "draft";
  const path = `shops/${shopId}/products/${folder}/${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const buf = await response.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("Photo trop volumineuse (max 5 Mo)");
  }
  const { error: upErr } = await supabase.storage.from(MERCHANT_PRODUCTS_BUCKET).upload(path, buf, {
    contentType: mimeType || "image/jpeg",
    upsert: false
  });
  if (upErr) {
    if (
      upErr.message?.includes("Bucket not found") ||
      upErr.message?.includes("bucket")
    ) {
      throw new Error(
        `Bucket Supabase « ${MERCHANT_PRODUCTS_BUCKET} » introuvable. Applique la migration storage merchant-products.`
      );
    }
    throw upErr;
  }
  const { data } = supabase.storage.from(MERCHANT_PRODUCTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
